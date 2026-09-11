"""Build and verify a deterministic offline copy of the integrity lab.

The builder deliberately keeps the package allowlist explicit.  It is a
small, standard-library-only tool for an educational package; it is not a
general repository archiver and it does not establish provenance or a
signature.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import posixpath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
import zlib
from pathlib import Path, PurePosixPath
from typing import Iterable, Mapping, Sequence


PACKAGE_FORMAT = "securium-forensics-integrity-offline-package-v1"
INTERNAL_MANIFEST_NAME = "package-manifest.json"
DEFAULT_ZIP_NAME = "securium-forensics-integrity-offline-package.zip"
DEFAULT_EXTERNAL_MANIFEST_NAME = "securium-forensics-integrity-offline-package.manifest.json"
MAX_ENTRY_BYTES = 16 * 1024 * 1024
MAX_PACKAGE_BYTES = 128 * 1024 * 1024
MAX_MANIFEST_BYTES = 2 * 1024 * 1024
MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 256
WINDOWS_RESERVED_NAMES = {
    "AUX",
    "CON",
    "NUL",
    "PRN",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}

# This is the complete source allowlist.  Builder code and package tests are
# intentionally not included in the extracted teaching package.
PACKAGE_ALLOWLIST: tuple[tuple[str, str], ...] = (
    (
        "examples/digital-forensics-integrity-local-lab/README.md",
        "examples/digital-forensics-integrity-local-lab/README.md",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/cli.py",
        "examples/digital-forensics-integrity-local-lab/cli.py",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/instructor-guide.md",
        "examples/digital-forensics-integrity-local-lab/instructor-guide.md",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/lab.py",
        "examples/digital-forensics-integrity-local-lab/lab.py",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/learner-guide.md",
        "examples/digital-forensics-integrity-local-lab/learner-guide.md",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/test_lab.py",
        "examples/digital-forensics-integrity-local-lab/test_lab.py",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/assessment-rubric.md",
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/assessment-rubric.md",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/instructor-runbook.md",
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/instructor-runbook.md",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/learner-workbook.md",
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/learner-workbook.md",
    ),
    (
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/rehearsal-checklist.md",
        "examples/digital-forensics-integrity-local-lab/rehearsal-kit/rehearsal-checklist.md",
    ),
    (
        "examples/digital-forensics-integrity-offline-package/README.md",
        "README.md",
    ),
)


class PackageError(Exception):
    """A safe, user-actionable package validation error."""


def _canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
        "utf-8"
    )


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        while True:
            block = source.read(1024 * 1024)
            if not block:
                break
            size += len(block)
            digest.update(block)
    return size, digest.hexdigest()


def _git_blob_sha1(value: bytes) -> str:
    header = f"blob {len(value)}\0".encode("ascii")
    return hashlib.sha1(header + value).hexdigest()


def _is_reparse_point(path: Path) -> bool:
    if path.is_symlink():
        return True
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    try:
        return bool(path.stat(follow_symlinks=False).st_file_attributes & reparse_flag)
    except (AttributeError, OSError):
        return False


def _safe_archive_path(value: str) -> str:
    if not isinstance(value, str) or not value or "\x00" in value:
        raise PackageError(f"unsafe archive path: {value!r}")
    if "\\" in value or value.startswith("/") or re.match(r"^[A-Za-z]:", value):
        raise PackageError(f"unsafe archive path: {value!r}")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise PackageError(f"unsafe archive path: {value!r}")
    for part in path.parts:
        if part.endswith((".", " ")):
            raise PackageError(f"Windows-unsafe archive path: {value!r}")
        if part.split(".", 1)[0].upper() in WINDOWS_RESERVED_NAMES:
            raise PackageError(f"Windows reserved archive path: {value!r}")
    return "/".join(path.parts)


def _archive_collision_key(value: str) -> str:
    return unicodedata.normalize("NFKC", value).casefold()


def _validate_allowlist(allowlist: Sequence[tuple[str, str]]) -> None:
    source_names: set[str] = set()
    archive_names: set[str] = set()
    for source_name, archive_name in allowlist:
        safe_source = _safe_archive_path(source_name)
        safe_archive = _safe_archive_path(archive_name)
        source_key = _archive_collision_key(safe_source)
        archive_key = _archive_collision_key(safe_archive)
        if source_key in source_names:
            raise PackageError(f"duplicate source path: {source_name}")
        if archive_key in archive_names:
            raise PackageError(f"duplicate or case-fold collision: {archive_name}")
        source_names.add(source_key)
        archive_names.add(archive_key)
    if INTERNAL_MANIFEST_NAME.casefold() in archive_names:
        raise PackageError("the generated manifest cannot be in the source allowlist")


def _repo_relative(root: Path, relative_name: str) -> Path:
    safe_name = _safe_archive_path(relative_name)
    candidate = root.joinpath(*safe_name.split("/"))
    root_resolved = root.resolve()
    try:
        candidate.resolve(strict=False).relative_to(root_resolved)
    except ValueError as error:
        raise PackageError(f"source path escapes repository root: {relative_name}") from error

    current = root
    for part in safe_name.split("/"):
        current = current / part
        if _is_reparse_point(current):
            raise PackageError(f"symlink/reparse source path is not allowed: {relative_name}")
    if not candidate.is_file():
        raise PackageError(f"allowlisted source file is missing: {relative_name}")
    return candidate


def _run_git(root: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ["git", "-C", str(root), *arguments],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode:
        detail = completed.stderr.strip() or completed.stdout.strip() or "git command failed"
        raise PackageError(detail)
    return completed.stdout.strip()


def _run_git_bytes(root: Path, *arguments: str) -> bytes:
    completed = subprocess.run(
        ["git", "-C", str(root), *arguments],
        check=False,
        capture_output=True,
    )
    if completed.returncode:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        if not detail:
            detail = completed.stdout.decode("utf-8", errors="replace").strip()
        raise PackageError(detail or "git command failed")
    return completed.stdout


def _source_commit(root: Path, requested: str | None, require_clean: bool) -> tuple[str, str]:
    commit = _run_git(root, "rev-parse", "--verify", "HEAD^{commit}")
    if requested and requested != commit:
        raise PackageError(f"requested source commit {requested} does not match HEAD {commit}")
    if require_clean:
        status = _run_git(root, "status", "--porcelain", "--untracked-files=all")
        if status:
            raise PackageError("repository worktree must be clean for source-bound package operations")
    tree = _run_git(root, "rev-parse", f"{commit}^{{tree}}")
    return commit, tree


def _commit_blob(root: Path, commit: str, source_name: str) -> str:
    return _run_git(root, "rev-parse", f"{commit}:{source_name}")


def _commit_bytes(root: Path, commit: str, source_name: str) -> bytes:
    return _run_git_bytes(root, "cat-file", "blob", f"{commit}:{source_name}")


def _committed_entries(
    root: Path,
    commit: str,
    allowlist: Sequence[tuple[str, str]] = PACKAGE_ALLOWLIST,
) -> list[dict[str, object]]:
    _validate_allowlist(allowlist)
    collected: list[dict[str, object]] = []
    total_size = 0
    for source_name, archive_name in allowlist:
        _repo_relative(root, source_name)
        data = _commit_bytes(root, commit, source_name)
        size = len(data)
        if size > MAX_ENTRY_BYTES:
            raise PackageError(f"source entry exceeds {MAX_ENTRY_BYTES} bytes: {source_name}")
        total_size += size
        if total_size > MAX_PACKAGE_BYTES:
            raise PackageError(f"source entries exceed {MAX_PACKAGE_BYTES} bytes")
        collected.append(
            {
                "source_path": source_name,
                "archive_path": _safe_archive_path(archive_name),
                "size": size,
                "sha256": _sha256_bytes(data),
                "git_blob_sha1": _git_blob_sha1(data),
                "_bytes": data,
            }
        )
    return sorted(collected, key=lambda entry: str(entry["archive_path"]))


def _collect_entries(
    root: Path,
    commit: str,
    allowlist: Sequence[tuple[str, str]] = PACKAGE_ALLOWLIST,
) -> list[dict[str, object]]:
    committed = _committed_entries(root, commit, allowlist)
    collected: list[dict[str, object]] = []
    for expected in committed:
        source_name = str(expected["source_path"])
        source_path = _repo_relative(root, source_name)
        data = source_path.read_bytes()
        size = len(data)
        actual_blob = _git_blob_sha1(data)
        if actual_blob != expected["git_blob_sha1"] or data != expected["_bytes"]:
            raise PackageError(f"source bytes do not match commit {commit}: {source_name}")
        entry = dict(expected)
        entry["_bytes"] = data
        collected.append(
            entry
        )
    return sorted(collected, key=lambda entry: str(entry["archive_path"]))


_MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")


def _normalise_link_target(document: str, target: str) -> str | None:
    target = target.strip()
    if target.startswith("<") and ">" in target:
        target = target[1 : target.index(">")]
    target = target.split("#", 1)[0].strip()
    if not target or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", target):
        return None
    if target.startswith("/") or re.match(r"^[A-Za-z]:", target) or "\\" in target:
        raise PackageError(f"unsafe Markdown link in {document}: {target}")
    candidate = posixpath.normpath(posixpath.join(posixpath.dirname(document), target))
    if candidate == "." or candidate.startswith("../") or candidate == "..":
        raise PackageError(f"Markdown link escapes package in {document}: {target}")
    return candidate


def _markdown_links(entries: Iterable[Mapping[str, object]]) -> dict[str, list[dict[str, str]]]:
    package_paths = {str(entry["archive_path"]) for entry in entries}
    internal: list[dict[str, str]] = []
    external: list[dict[str, str]] = []
    for entry in entries:
        document = str(entry["archive_path"])
        if not document.lower().endswith(".md"):
            continue
        data = entry.get("_bytes")
        if not isinstance(data, bytes):
            raise PackageError(f"missing link source bytes for {document}")
        text = data.decode("utf-8")
        for match in _MARKDOWN_LINK.finditer(text):
            raw_target = match.group(1).strip()
            target = _normalise_link_target(document, raw_target)
            if target is None:
                if raw_target and not raw_target.startswith("#"):
                    external.append({"document": document, "target": raw_target, "kind": "external-url"})
                continue
            if target in package_paths:
                internal.append({"document": document, "target": target, "kind": "package-relative"})
            elif target == "content-drafts" or target.startswith("content-drafts/"):
                external.append(
                    {
                        "document": document,
                        "target": target,
                        "kind": "repository-relative-external; not packaged",
                    }
                )
            else:
                raise PackageError(f"missing package-relative Markdown link: {document} -> {raw_target}")
    return {"internal": internal, "external": external}


def _zip_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.create_version = 20
    info.extract_version = 20
    info.flag_bits = 0
    info.volume = 0
    info.internal_attr = 0
    info.external_attr = 0o100644 << 16
    info.extra = b""
    info.comment = b""
    info.compress_type = zipfile.ZIP_DEFLATED
    return info


def _write_zip(path: Path, entries: Mapping[str, bytes]) -> None:
    if path.exists() or path.is_symlink() or _is_reparse_point(path):
        raise PackageError(f"refusing to overwrite existing ZIP: {path}")
    created = False
    try:
        with path.open("xb") as handle:
            created = True
            with zipfile.ZipFile(
                handle,
                mode="w",
                compression=zipfile.ZIP_DEFLATED,
                compresslevel=9,
                allowZip64=False,
            ) as archive:
                for name in sorted(entries):
                    archive.writestr(
                        _zip_info(_safe_archive_path(name)),
                        entries[name],
                        compress_type=zipfile.ZIP_DEFLATED,
                        compresslevel=9,
                    )
    except Exception:
        if created and path.exists() and not _is_reparse_point(path):
            path.unlink()
        raise


def _safe_output_dir(path: Path, repository_root: Path) -> Path:
    root = repository_root.resolve()
    output = path.resolve()
    try:
        output.relative_to(root)
    except ValueError:
        pass
    else:
        raise PackageError("artifact output directory must be outside the repository")
    if path.exists() and (_is_reparse_point(path) or not path.is_dir()):
        raise PackageError(f"unsafe artifact output directory: {path}")
    for ancestor in path.parents:
        if ancestor.exists() and _is_reparse_point(ancestor):
            raise PackageError(f"reparse path in artifact output parents: {path}")
    path.mkdir(parents=True, exist_ok=True)
    if _is_reparse_point(path):
        raise PackageError(f"unsafe artifact output directory: {path}")
    return path


def _safe_filename(name: str, label: str) -> str:
    if not name or "\x00" in name or "/" in name or "\\" in name:
        raise PackageError(f"{label} must be a simple filename")
    if name in {".", ".."}:
        raise PackageError(f"unsafe {label}: {name}")
    if name.endswith((".", " ")) or name.split(".", 1)[0].upper() in WINDOWS_RESERVED_NAMES:
        raise PackageError(f"Windows-unsafe {label}: {name}")
    return name


def _write_json_no_overwrite(path: Path, value: object) -> None:
    if path.exists() or path.is_symlink() or _is_reparse_point(path):
        raise PackageError(f"refusing to overwrite existing JSON: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
    except Exception:
        if path.exists() and not _is_reparse_point(path):
            path.unlink()
        raise


def build_package(
    repository_root: Path,
    output_dir: Path,
    source_commit: str | None = None,
    zip_name: str = DEFAULT_ZIP_NAME,
    external_manifest_name: str = DEFAULT_EXTERNAL_MANIFEST_NAME,
    require_clean: bool = True,
) -> dict[str, object]:
    root = repository_root.resolve()
    if not root.is_dir() or _is_reparse_point(root):
        raise PackageError(f"unsafe repository root: {repository_root}")
    commit, tree = _source_commit(root, source_commit, require_clean)
    output = _safe_output_dir(output_dir, root)
    zip_file_name = _safe_filename(zip_name, "ZIP name")
    manifest_file_name = _safe_filename(external_manifest_name, "manifest name")
    zip_path = output / zip_file_name
    external_manifest_path = output / manifest_file_name
    if zip_path.exists() or external_manifest_path.exists():
        raise PackageError("refusing to overwrite an existing package artifact")

    entries = _collect_entries(root, commit)
    links = _markdown_links(entries)
    manifest_entries = [
        {key: value for key, value in entry.items() if key != "_bytes"} for entry in entries
    ]
    internal_manifest = {
        "format": PACKAGE_FORMAT,
        "manifest_role": "describes source entries; does not hash itself or the final ZIP",
        "self_not_included_in_entries": True,
        "source_commit": commit,
        "source_tree": tree,
        "source_worktree_clean": require_clean,
        "entry_count": len(manifest_entries),
        "entries": manifest_entries,
        "markdown_links": links,
        "reproducibility": {
            "zip_timestamp": "1980-01-01T00:00:00Z",
            "compression": "deflate",
            "compresslevel": 9,
            "python": platform.python_version(),
            "zlib": zlib.ZLIB_VERSION,
            "os": os.name,
            "platform": sys.platform,
            "scope": "same source bytes and builder environment only",
            "cross_environment_claim": False,
        },
    }
    internal_bytes = _canonical_json(internal_manifest)
    zip_entries = {str(entry["archive_path"]): entry["_bytes"] for entry in entries}
    zip_entries[INTERNAL_MANIFEST_NAME] = internal_bytes
    if sum(len(data) for data in zip_entries.values()) > MAX_PACKAGE_BYTES:
        raise PackageError(f"package entries exceed {MAX_PACKAGE_BYTES} bytes")

    _write_zip(zip_path, zip_entries)
    zip_size, zip_sha256 = _sha256_file(zip_path)
    external_manifest = {
        "format": PACKAGE_FORMAT,
        "manifest_role": "records the final ZIP bytes; does not replace entry verification",
        "zip_file": zip_file_name,
        "zip_size": zip_size,
        "zip_sha256": zip_sha256,
        "internal_manifest_file": INTERNAL_MANIFEST_NAME,
        "internal_manifest_sha256": _sha256_bytes(internal_bytes),
        "entry_count_including_internal_manifest": len(zip_entries),
        "source_commit": commit,
        "source_tree": tree,
        "reproducibility_scope": "same source bytes and builder environment only",
        "cross_environment_claim": False,
    }
    try:
        _write_json_no_overwrite(external_manifest_path, external_manifest)
    except Exception:
        if zip_path.exists() and not _is_reparse_point(zip_path):
            zip_path.unlink()
        raise
    return {
        "status": "BUILT",
        "source_commit": commit,
        "source_tree": tree,
        "entry_count": len(zip_entries),
        "source_entry_count": len(entries),
        "zip_path": str(zip_path.resolve()),
        "zip_size": zip_size,
        "zip_sha256": zip_sha256,
        "external_manifest_path": str(external_manifest_path.resolve()),
        "external_manifest_sha256": _sha256_file(external_manifest_path)[1],
    }


def _read_json(path: Path) -> object:
    if _is_reparse_point(path) or not path.is_file():
        raise PackageError(f"unsafe or missing JSON file: {path}")
    if path.stat().st_size > MAX_MANIFEST_BYTES:
        raise PackageError(f"JSON file exceeds {MAX_MANIFEST_BYTES} bytes: {path.name}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise PackageError(f"invalid JSON: {path.name}") from error


def _validate_zip_name(name: str) -> str:
    return _safe_archive_path(name)


def _zip_has_symlink(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    return stat.S_IFMT(mode) == stat.S_IFLNK


def _safe_extract_root(path: Path) -> Path:
    if path.exists() or path.is_symlink() or _is_reparse_point(path):
        raise PackageError(f"extraction directory must not already exist: {path}")
    for ancestor in path.parents:
        if ancestor.exists() and _is_reparse_point(ancestor):
            raise PackageError(f"reparse path in extraction parents: {path}")
    path.mkdir(parents=True, exist_ok=False)
    if _is_reparse_point(path):
        raise PackageError(f"unsafe extraction directory: {path}")
    return path


def _extract_entries(archive: zipfile.ZipFile, names: Sequence[str], root: Path) -> None:
    root_resolved = root.resolve()
    for name in names:
        safe_name = _validate_zip_name(name)
        target = root.joinpath(*safe_name.split("/"))
        try:
            target.resolve(strict=False).relative_to(root_resolved)
        except ValueError as error:
            raise PackageError(f"archive entry escapes extraction root: {name}") from error
        current = root
        parts = safe_name.split("/")
        for part in parts[:-1]:
            current = current / part
            if current.exists() and _is_reparse_point(current):
                raise PackageError(f"reparse path in extraction destination: {name}")
            current.mkdir(exist_ok=True)
        if target.exists() or target.is_symlink() or _is_reparse_point(target):
            raise PackageError(f"refusing to overwrite extraction target: {name}")
        data = archive.read(name)
        with target.open("xb") as handle:
            handle.write(data)


def _remove_owned_directory(path: Path) -> None:
    if not path.exists():
        return
    if _is_reparse_point(path) or not path.is_dir():
        raise PackageError(f"refusing cleanup of replaced extraction path: {path}")
    shutil.rmtree(path)


def verify_package(
    zip_path: Path,
    external_manifest_path: Path,
    extract_dir: Path | None = None,
    report_path: Path | None = None,
    *,
    trusted_repository_root: Path | None = None,
    trusted_source_commit: str | None = None,
) -> dict[str, object]:
    result: dict[str, object] = {
        "status": "REJECTED",
        "source_verification": "NOT_VERIFIED",
        "zip_path": str(zip_path.resolve()),
        "external_manifest_path": str(external_manifest_path.resolve()),
        "errors": [],
    }
    owned_extract: Path | None = None
    try:
        if trusted_repository_root is None:
            raise PackageError("trusted repository root is required for source-bound verification")
        trusted_root = trusted_repository_root.resolve()
        trusted_commit, trusted_tree = _source_commit(
            trusted_root,
            trusted_source_commit,
            require_clean=True,
        )
        trusted_entries = _committed_entries(trusted_root, trusted_commit)
        expected_by_archive = {
            str(entry["archive_path"]): entry for entry in trusted_entries
        }

        if _is_reparse_point(zip_path) or not zip_path.is_file():
            raise PackageError(f"unsafe or missing ZIP file: {zip_path}")
        if zip_path.stat().st_size > MAX_ARCHIVE_BYTES:
            raise PackageError(f"ZIP exceeds {MAX_ARCHIVE_BYTES} bytes")
        external = _read_json(external_manifest_path)
        if not isinstance(external, dict) or external.get("format") != PACKAGE_FORMAT:
            raise PackageError("external manifest format is not supported")
        if external.get("manifest_role") != "records the final ZIP bytes; does not replace entry verification":
            raise PackageError("external manifest role is invalid")
        if (
            external.get("reproducibility_scope") != "same source bytes and builder environment only"
            or external.get("cross_environment_claim") is not False
        ):
            raise PackageError("external reproducibility metadata is invalid")
        expected_size = external.get("zip_size")
        expected_hash = external.get("zip_sha256")
        if not isinstance(expected_size, int) or not isinstance(expected_hash, str):
            raise PackageError("external manifest has invalid ZIP size or hash")
        actual_size, actual_hash = _sha256_file(zip_path)
        if actual_size != expected_size or actual_hash != expected_hash:
            raise PackageError("ZIP bytes do not match the external manifest")
        if external.get("zip_file") != zip_path.name:
            raise PackageError("ZIP filename does not match the external manifest")
        if external.get("internal_manifest_file") != INTERNAL_MANIFEST_NAME:
            raise PackageError("external manifest internal filename is not the package manifest")
        if external.get("source_commit") != trusted_commit:
            raise PackageError("external manifest source commit does not match the trusted checkout")
        if external.get("source_tree") != trusted_tree:
            raise PackageError("external manifest source tree does not match the trusted checkout")

        with zipfile.ZipFile(zip_path, "r") as archive:
            infos = archive.infolist()
            if not infos:
                raise PackageError("ZIP contains no entries")
            if len(infos) > MAX_ARCHIVE_ENTRIES:
                raise PackageError(f"ZIP contains more than {MAX_ARCHIVE_ENTRIES} entries")
            names: list[str] = []
            seen_exact: set[str] = set()
            seen_folded: set[str] = set()
            total_uncompressed_size = 0
            for info in infos:
                safe_name = _validate_zip_name(info.filename)
                if info.is_dir() or _zip_has_symlink(info):
                    raise PackageError(f"directory or symlink ZIP entry is not allowed: {info.filename}")
                if safe_name in seen_exact or _archive_collision_key(safe_name) in seen_folded:
                    raise PackageError(f"duplicate or case-fold collision in ZIP: {info.filename}")
                if info.file_size > MAX_ENTRY_BYTES:
                    raise PackageError(f"ZIP entry exceeds {MAX_ENTRY_BYTES} bytes: {info.filename}")
                total_uncompressed_size += info.file_size
                if total_uncompressed_size > MAX_PACKAGE_BYTES:
                    raise PackageError(f"ZIP uncompressed entries exceed {MAX_PACKAGE_BYTES} bytes")
                names.append(safe_name)
                seen_exact.add(safe_name)
                seen_folded.add(_archive_collision_key(safe_name))

            if INTERNAL_MANIFEST_NAME not in seen_exact:
                raise PackageError("internal package manifest is missing")
            internal_bytes = archive.read(INTERNAL_MANIFEST_NAME)
            if len(internal_bytes) > MAX_MANIFEST_BYTES:
                raise PackageError("internal package manifest is too large")
            try:
                internal = json.loads(internal_bytes.decode("utf-8"))
            except (UnicodeError, json.JSONDecodeError) as error:
                raise PackageError("internal package manifest is invalid JSON") from error
            if not isinstance(internal, dict) or internal.get("format") != PACKAGE_FORMAT:
                raise PackageError("internal package manifest format is not supported")
            if internal.get("manifest_role") != "describes source entries; does not hash itself or the final ZIP":
                raise PackageError("internal manifest role is invalid")
            if internal.get("self_not_included_in_entries") is not True:
                raise PackageError("internal manifest self-hash boundary is missing")
            manifest_entries = internal.get("entries")
            if not isinstance(manifest_entries, list) or internal.get("entry_count") != len(manifest_entries):
                raise PackageError("internal manifest entry count is invalid")
            if internal.get("entry_count") != len(expected_by_archive):
                raise PackageError("internal manifest entry count does not match the trusted source")
            if external.get("entry_count_including_internal_manifest") != len(names):
                raise PackageError("external manifest entry count is invalid")
            if external.get("internal_manifest_sha256") != _sha256_bytes(internal_bytes):
                raise PackageError("internal manifest bytes do not match the external manifest")
            if internal.get("source_commit") != trusted_commit:
                raise PackageError("internal manifest source commit does not match the trusted checkout")
            if internal.get("source_tree") != trusted_tree:
                raise PackageError("internal manifest source tree does not match the trusted checkout")
            if internal.get("source_worktree_clean") is not True:
                raise PackageError("internal manifest does not record a clean source worktree")
            reproducibility = internal.get("reproducibility")
            if (
                not isinstance(reproducibility, dict)
                or reproducibility.get("zip_timestamp") != "1980-01-01T00:00:00Z"
                or reproducibility.get("compression") != "deflate"
                or reproducibility.get("compresslevel") != 9
                or reproducibility.get("scope") != "same source bytes and builder environment only"
                or reproducibility.get("cross_environment_claim") is not False
            ):
                raise PackageError("internal reproducibility metadata is invalid")
            if external.get("source_commit") != internal.get("source_commit"):
                raise PackageError("source commit differs between manifests")

            manifest_entries_by_archive: dict[str, Mapping[str, object]] = {}
            for entry in manifest_entries:
                if not isinstance(entry, dict):
                    raise PackageError("internal manifest contains an invalid entry")
                name = _validate_zip_name(str(entry.get("archive_path", "")))
                if name == INTERNAL_MANIFEST_NAME or name in manifest_entries_by_archive:
                    raise PackageError("internal manifest contains a duplicate or self entry")
                if _archive_collision_key(name) in {
                    _archive_collision_key(item) for item in manifest_entries_by_archive
                }:
                    raise PackageError("internal manifest contains a case-fold collision")
                if not isinstance(entry.get("size"), int) or not isinstance(entry.get("sha256"), str):
                    raise PackageError(f"invalid size or hash for entry: {name}")
                trusted_entry = expected_by_archive.get(name)
                if trusted_entry is None:
                    raise PackageError(f"manifest entry is not in the trusted source allowlist: {name}")
                for field in ("source_path", "archive_path", "size", "sha256", "git_blob_sha1"):
                    if entry.get(field) != trusted_entry.get(field):
                        raise PackageError(f"manifest {field} does not match the trusted source: {name}")
                manifest_entries_by_archive[name] = entry
            actual_source_names = set(names) - {INTERNAL_MANIFEST_NAME}
            if actual_source_names != set(expected_by_archive):
                missing = sorted(set(expected_by_archive) - actual_source_names)
                additional = sorted(actual_source_names - set(expected_by_archive))
                raise PackageError(f"entry set mismatch; missing={missing}, additional={additional}")
            if external.get("entry_count_including_internal_manifest") != len(expected_by_archive) + 1:
                raise PackageError("external manifest entry count does not match the trusted source")
            if set(manifest_entries_by_archive) != set(expected_by_archive):
                missing = sorted(set(expected_by_archive) - set(manifest_entries_by_archive))
                additional = sorted(set(manifest_entries_by_archive) - set(expected_by_archive))
                raise PackageError(f"manifest entry set mismatch; missing={missing}, additional={additional}")

            source_entry_views: list[dict[str, object]] = []
            for name in sorted(expected_by_archive):
                data = archive.read(name)
                entry = manifest_entries_by_archive[name]
                observed = {"archive_path": name, "size": len(data), "sha256": _sha256_bytes(data)}
                if observed["size"] != entry["size"] or observed["sha256"] != entry["sha256"]:
                    raise PackageError(f"entry bytes do not match internal manifest: {name}")
                trusted_entry = expected_by_archive[name]
                if data != trusted_entry["_bytes"]:
                    raise PackageError(f"source entry bytes do not match the trusted Git source: {name}")
                source_entry_views.append({"archive_path": name, "_bytes": data})
            links = _markdown_links(source_entry_views)
            if internal.get("markdown_links") != links:
                raise PackageError("internal Markdown link metadata does not match the trusted source")

            if extract_dir is not None:
                owned_extract = _safe_extract_root(extract_dir)
                _extract_entries(archive, names, owned_extract)

        result.update(
            {
                "status": "PASS",
                "zip_size": actual_size,
                "zip_sha256": actual_hash,
                "entry_count": len(names),
                "source_entry_count": len(manifest_entries_by_archive),
                "source_commit": internal["source_commit"],
                "source_tree": internal.get("source_tree"),
                "trusted_source_commit": trusted_commit,
                "trusted_source_tree": trusted_tree,
                "source_verification": "PASS",
                "markdown_links": links,
                "extraction": {
                    "status": "PASS" if extract_dir is not None else "NOT_REQUESTED",
                    "path": str(owned_extract.resolve()) if owned_extract else None,
                },
            }
        )
    except (KeyError, OSError, PackageError, TypeError, ValueError, zipfile.BadZipFile) as error:
        result["errors"] = [str(error)]
        if owned_extract is not None:
            try:
                _remove_owned_directory(owned_extract)
                result["extraction_cleanup"] = "owned_partial_workspace_removed"
            except (OSError, PackageError) as cleanup_error:
                result["extraction_cleanup"] = f"cleanup_rejected: {cleanup_error}"
    if report_path is not None:
        _write_json_no_overwrite(report_path, result)
        result["report_path"] = str(report_path.resolve())
    return result


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build or verify the forensic integrity offline package")
    commands = parser.add_subparsers(dest="command", required=True)

    build = commands.add_parser("build", help="create a deterministic package outside the repository")
    build.add_argument("--repository-root", type=Path, default=Path.cwd())
    build.add_argument("--output-dir", type=Path, required=True)
    build.add_argument("--source-commit")
    build.add_argument("--zip-name", default=DEFAULT_ZIP_NAME)
    build.add_argument("--manifest-name", default=DEFAULT_EXTERNAL_MANIFEST_NAME)

    verify = commands.add_parser("verify", help="verify and optionally extract a package")
    verify.add_argument("--zip", dest="zip_path", type=Path, required=True)
    verify.add_argument("--manifest", dest="manifest_path", type=Path, required=True)
    verify.add_argument("--repository-root", type=Path, required=True)
    verify.add_argument("--source-commit", required=True)
    verify.add_argument("--extract-dir", type=Path)
    verify.add_argument("--report", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        if args.command == "build":
            result = build_package(
                args.repository_root,
                args.output_dir,
                source_commit=args.source_commit,
                zip_name=args.zip_name,
                external_manifest_name=args.manifest_name,
            )
        else:
            result = verify_package(
                args.zip_path,
                args.manifest_path,
                extract_dir=args.extract_dir,
                report_path=args.report,
                trusted_repository_root=args.repository_root,
                trusted_source_commit=args.source_commit,
            )
    except (OSError, PackageError) as error:
        print(json.dumps({"status": "REJECTED", "error": str(error)}, sort_keys=True), file=sys.stderr)
        return 2
    # Keep machine-readable CLI output safe on Windows consoles that are not
    # UTF-8 capable; package and manifest files remain UTF-8 bytes.
    print(json.dumps(result, ensure_ascii=True, indent=2, sort_keys=True))
    return 0 if result.get("status") in {"BUILT", "PASS"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
