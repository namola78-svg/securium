#!/usr/bin/env python3
"""Build and verify a deterministic, repository-independent Python lab ZIP.

The builder intentionally has a narrow source allowlist.  It packages only the
Python 8H local-lab bundle and the instructor kit; the browser reviewer harness,
repository metadata, and generated evidence remain outside the archive.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import time
from typing import Any, Iterable
from urllib.parse import unquote
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
LAB_ROOT_REL = Path("examples/python-secure-coding-8h-priority-labs")
PACKAGE_ROOT = "python-secure-coding-8h-offline"
PACKAGE_README_SOURCE = Path(__file__).with_name("package-readme.md")
MANIFEST_VERSION = 1
LINK_RE = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
REPOSITORY_ONLY_LINKS = {
    "verification/m05-browser",
    "verification/m05-browser/",
    "../../../content-drafts/secure-coding-8h-foundation/manifest.json",
}

FOCUSED_COMMANDS: tuple[tuple[str, tuple[str, ...], int], ...] = (
    ("M01", ("m01_trust_boundary.test_m01",), 5),
    ("M02", ("m02_injection.test_m02",), 5),
    ("M03", ("m03_deserialization.test_m03",), 6),
    ("M04", ("m04_files_ssrf.test_m04",), 6),
    ("M05", ("m05_web_context.test_m05",), 7),
    ("M06", ("m06_authorization.test_m06",), 5),
    ("M07", ("m07_secrets_dependencies.test_m07",), 10),
    ("M08", ("m08_capstone.test_m08",), 6),
)

# This is deliberately explicit.  A newly added file must be reviewed before
# it can enter the offline distribution, and an omitted file fails the build.
SOURCE_FILES = tuple(
    sorted(
        {
            "README.md",
            "pyproject.toml",
            "instructor-kit/README.md",
            "instructor-kit/assessment-rubric.md",
            "instructor-kit/instructor-runbook.md",
            "instructor-kit/learner-verification-workbook.md",
            "instructor-kit/rehearsal-checklist.md",
            "m01_trust_boundary/__init__.py",
            "m01_trust_boundary/instructor.md",
            "m01_trust_boundary/learner.md",
            "m01_trust_boundary/models.py",
            "m01_trust_boundary/secure.py",
            "m01_trust_boundary/test_m01.py",
            "m01_trust_boundary/verification-record.md",
            "m01_trust_boundary/vulnerable.py",
            "m02_injection/__init__.py",
            "m02_injection/instructor.md",
            "m02_injection/learner.md",
            "m02_injection/secure.py",
            "m02_injection/test_m02.py",
            "m02_injection/vulnerable.py",
            "m03_deserialization/__init__.py",
            "m03_deserialization/instructor.md",
            "m03_deserialization/learner.md",
            "m03_deserialization/secure.py",
            "m03_deserialization/test_m03.py",
            "m03_deserialization/vulnerable.py",
            "m04_files_ssrf/__init__.py",
            "m04_files_ssrf/instructor.md",
            "m04_files_ssrf/learner.md",
            "m04_files_ssrf/secure.py",
            "m04_files_ssrf/test_m04.py",
            "m04_files_ssrf/vulnerable.py",
            "m05_web_context/__init__.py",
            "m05_web_context/common.py",
            "m05_web_context/instructor.md",
            "m05_web_context/learner.md",
            "m05_web_context/secure.py",
            "m05_web_context/test_m05.py",
            "m05_web_context/verification-record.md",
            "m05_web_context/vulnerable.py",
            "m06_authorization/__init__.py",
            "m06_authorization/instructor.md",
            "m06_authorization/learner.md",
            "m06_authorization/secure.py",
            "m06_authorization/session.py",
            "m06_authorization/test_m06.py",
            "m06_authorization/vulnerable.py",
            "m07_secrets_dependencies/__init__.py",
            "m07_secrets_dependencies/instructor.md",
            "m07_secrets_dependencies/learner.md",
            "m07_secrets_dependencies/secure.py",
            "m07_secrets_dependencies/test_m07.py",
            "m07_secrets_dependencies/vulnerable.py",
            "m08_capstone/__init__.py",
            "m08_capstone/human-review-template.md",
            "m08_capstone/instructor.md",
            "m08_capstone/learner.md",
            "m08_capstone/secure_app.py",
            "m08_capstone/test_m08.py",
            "m08_capstone/vulnerable_app.py",
        }
    )
)
EXCLUDED_SOURCE_FILES = (".gitignore",)


class PackageError(RuntimeError):
    """A user-actionable packaging or verification failure."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
        "utf-8"
    )


def ensure_outside(path: Path, repository_root: Path, label: str) -> None:
    try:
        path.relative_to(repository_root)
    except ValueError:
        return
    raise PackageError(f"{label} must be outside the repository/worktree: {path}")


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(REPOSITORY_ROOT), *args],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip()
        raise PackageError(f"git {' '.join(args)} failed: {detail}")
    return result.stdout.strip()


def source_commit_and_files() -> tuple[str, list[dict[str, Any]], list[str]]:
    lab_root = (REPOSITORY_ROOT / LAB_ROOT_REL).resolve()
    if not lab_root.is_dir():
        raise PackageError(f"lab source directory is missing: {lab_root}")
    if not PACKAGE_README_SOURCE.is_file() or PACKAGE_README_SOURCE.is_symlink():
        raise PackageError(f"package guide is missing or symlinked: {PACKAGE_README_SOURCE}")

    for path in lab_root.rglob("*"):
        if path.is_symlink():
            raise PackageError(f"symlinks are not permitted in the lab source: {path}")

    actual_files = {
        path.relative_to(lab_root).as_posix()
        for path in lab_root.rglob("*")
        if path.is_file()
    }
    expected_files = set(SOURCE_FILES)
    missing = sorted(expected_files - actual_files)
    excluded_files = sorted(actual_files & set(EXCLUDED_SOURCE_FILES))
    unexpected = sorted(actual_files - expected_files - set(EXCLUDED_SOURCE_FILES))
    if missing or unexpected:
        details = []
        if missing:
            details.append(f"missing={missing}")
        if unexpected:
            details.append(f"unexpected={unexpected}")
        raise PackageError("source allowlist mismatch: " + "; ".join(details))

    source_diff = subprocess.run(
        ["git", "-C", str(REPOSITORY_ROOT), "diff", "--quiet", "HEAD", "--", str(LAB_ROOT_REL)],
        check=False,
    )
    if source_diff.returncode:
        raise PackageError("lab source has uncommitted changes; build from a committed source tree")

    # The package provenance is the last commit that changed the packaged lab
    # tree, not a later commit that only changes this packaging helper.
    commit = run_git("log", "-1", "--format=%H", "--", str(LAB_ROOT_REL))
    records: list[dict[str, Any]] = []
    for relative in SOURCE_FILES:
        path = lab_root / Path(relative)
        if not path.is_file() or path.is_symlink():
            raise PackageError(f"allowlisted source is not a regular file: {path}")
        data = path.read_bytes()
        records.append(
            {
                "archive_path": f"{PACKAGE_ROOT}/lab/{relative}",
                "source_path": relative,
                "bytes": len(data),
                "sha256": sha256_bytes(data),
            }
        )
    return commit, records, excluded_files


def package_readme(source_commit: str) -> bytes:
    text = PACKAGE_README_SOURCE.read_text(encoding="utf-8")
    if "{{SOURCE_COMMIT}}" not in text:
        raise PackageError("package guide is missing the {{SOURCE_COMMIT}} marker")
    return text.replace("{{SOURCE_COMMIT}}", source_commit).encode("utf-8")


def zip_info(name: str) -> ZipInfo:
    info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    info.internal_attr = 0
    info.flag_bits = 0x800
    info.extra = b""
    info.comment = b""
    return info


def write_new(path: Path, data: bytes) -> None:
    if path.exists():
        raise PackageError(f"refusing to overwrite existing output: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def build(output_dir: Path) -> dict[str, Any]:
    output_dir = output_dir.expanduser().resolve()
    ensure_outside(output_dir, REPOSITORY_ROOT, "output directory")
    output_dir.mkdir(parents=True, exist_ok=True)
    commit, source_records, excluded_files = source_commit_and_files()
    builder_commit = run_git("rev-parse", "HEAD^{commit}")
    readme_data = package_readme(commit)
    lab_root = (REPOSITORY_ROOT / LAB_ROOT_REL).resolve()

    source_manifest = {
        "manifest_version": MANIFEST_VERSION,
        "source_commit": commit,
        "source_path": LAB_ROOT_REL.as_posix(),
        "excluded_source_files": excluded_files,
        "files": source_records,
    }
    internal_manifest_data = json_bytes(source_manifest)
    entries: list[tuple[str, bytes]] = [
        (f"{PACKAGE_ROOT}/README.md", readme_data),
        (f"{PACKAGE_ROOT}/SOURCE-MANIFEST.json", internal_manifest_data),
    ]
    for record in source_records:
        entries.append((record["archive_path"], (lab_root / Path(record["source_path"])).read_bytes()))
    entries.sort(key=lambda item: item[0])

    archive_name = f"securium-python-8h-offline-lab-{commit[:12]}.zip"
    manifest_name = f"securium-python-8h-offline-lab-{commit[:12]}.manifest.json"
    archive_path = output_dir / archive_name
    manifest_path = output_dir / manifest_name
    ensure_outside(archive_path, REPOSITORY_ROOT, "archive")
    ensure_outside(manifest_path, REPOSITORY_ROOT, "manifest")

    try:
        with ZipFile(archive_path, "x", compression=ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as archive:
            for name, data in entries:
                archive.writestr(zip_info(name), data)
        archive_data = archive_path.read_bytes()
        archive_entries = [
            {"path": name, "bytes": len(data), "sha256": sha256_bytes(data)}
            for name, data in entries
        ]
        manifest = {
            "manifest_version": MANIFEST_VERSION,
            "source_commit": commit,
            "builder_commit": builder_commit,
            "source_path": LAB_ROOT_REL.as_posix(),
            "excluded_source_files": excluded_files,
            "source_file_count": len(source_records),
            "archive_file_count": len(entries),
            "files": source_records,
            "archive_entries": archive_entries,
            "archive": {
                "filename": archive_name,
                "bytes": len(archive_data),
                "sha256": sha256_bytes(archive_data),
            },
        }
        write_new(manifest_path, json_bytes(manifest))
    except Exception:
        if archive_path.exists() and not manifest_path.exists():
            archive_path.unlink()
        raise

    return {
        "status": "PASS",
        "source_commit": commit,
        "builder_commit": builder_commit,
        "source_file_count": len(source_records),
        "archive_file_count": len(entries),
        "archive": {"path": str(archive_path), "bytes": len(archive_data), "sha256": sha256_bytes(archive_data)},
        "manifest": str(manifest_path),
    }


def safe_member_name(name: str) -> PurePosixPath:
    if not name or "\\" in name:
        raise PackageError(f"invalid archive member path: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise PackageError(f"archive member escapes extraction root: {name!r}")
    return path


def link_targets(root: Path) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    missing: list[dict[str, str]] = []
    repository_only: list[dict[str, str]] = []
    for markdown in sorted(root.rglob("*.md")):
        text = markdown.read_text(encoding="utf-8")
        for raw_target in LINK_RE.findall(text):
            target = raw_target.strip().split()[0].strip("<>")
            path_part = target.split("#", 1)[0]
            if not path_part or path_part.startswith(("http://", "https://", "mailto:", "data:")):
                continue
            if path_part in REPOSITORY_ONLY_LINKS:
                repository_only.append({"source": markdown.relative_to(root).as_posix(), "target": path_part})
                continue
            candidate = (markdown.parent / Path(unquote(path_part))).resolve()
            try:
                candidate.relative_to(root.resolve())
            except ValueError:
                missing.append({"source": markdown.relative_to(root).as_posix(), "target": path_part})
                continue
            if not candidate.is_file() and not candidate.is_dir():
                missing.append({"source": markdown.relative_to(root).as_posix(), "target": path_part})
    return missing, repository_only


def run_test(
    extracted_lab: Path, label: str, unittest_args: tuple[str, ...], expected: int
) -> dict[str, Any]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment.pop("PYTHONHOME", None)
    environment["PYTHONNOUSERSITE"] = "1"
    command = [sys.executable, "-m", "unittest", *unittest_args]
    started = time.monotonic()
    try:
        result = subprocess.run(
            command,
            cwd=extracted_lab,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180,
            check=False,
        )
        output = f"{result.stdout}\n{result.stderr}"
        match = re.findall(r"Ran (\d+) tests?", output)
        actual = int(match[-1]) if match else None
        return {
            "label": label,
            "command": command,
            "expected_tests": expected,
            "actual_tests": actual,
            "returncode": result.returncode,
            "status": "PASS" if result.returncode == 0 and actual == expected else "FAIL",
            "elapsed_seconds": round(time.monotonic() - started, 3),
        }
    except subprocess.TimeoutExpired:
        return {
            "label": label,
            "command": command,
            "expected_tests": expected,
            "actual_tests": None,
            "returncode": None,
            "status": "FAIL",
            "error": "timeout after 180 seconds; child process was terminated",
            "elapsed_seconds": round(time.monotonic() - started, 3),
        }


def verify(archive_path: Path, manifest_path: Path, extract_dir: Path, report_path: Path) -> dict[str, Any]:
    archive_path = archive_path.expanduser().resolve()
    manifest_path = manifest_path.expanduser().resolve()
    extract_dir = extract_dir.expanduser().resolve()
    report_path = report_path.expanduser().resolve()
    ensure_outside(archive_path, REPOSITORY_ROOT, "archive")
    ensure_outside(manifest_path, REPOSITORY_ROOT, "manifest")
    ensure_outside(extract_dir, REPOSITORY_ROOT, "extraction directory")
    ensure_outside(report_path, REPOSITORY_ROOT, "report")
    if extract_dir.exists():
        raise PackageError(f"refusing to use existing extraction directory: {extract_dir}")

    report: dict[str, Any] = {
        "status": "FAIL",
        "archive": str(archive_path),
        "manifest": str(manifest_path),
        "extraction_directory": str(extract_dir),
        "python": sys.version,
        "commands": [],
        "links": {},
        "manifest_validation": {},
        "execution_boundary": {
            "working_directory": "extracted archive lab/",
            "PYTHONPATH_cleared": True,
            "PYTHONHOME_cleared": True,
        },
        "cleanup": {"extraction_removed": False, "child_processes": "not_started"},
    }
    created_extract = False
    failure: Exception | None = None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        archive_data = archive_path.read_bytes()
        archive_metadata = manifest["archive"]
        if len(archive_data) != archive_metadata["bytes"] or sha256_bytes(archive_data) != archive_metadata["sha256"]:
            raise PackageError("archive size or SHA-256 does not match the manifest")
        report["manifest_validation"] = {
            "status": "PASS",
            "source_commit": manifest["source_commit"],
            "source_file_count": manifest["source_file_count"],
            "archive_file_count": manifest["archive_file_count"],
            "archive_sha256": archive_metadata["sha256"],
        }

        with ZipFile(archive_path) as archive:
            if archive.testzip() is not None:
                raise PackageError("ZIP CRC validation failed")
            infos = archive.infolist()
            names = [safe_member_name(info.filename).as_posix() for info in infos]
            if len(names) != len(set(names)):
                raise PackageError("archive contains duplicate member paths")
            expected_entries = {entry["path"]: entry for entry in manifest["archive_entries"]}
            if set(names) != set(expected_entries):
                raise PackageError("archive member list differs from manifest")
            extract_dir.mkdir(parents=True)
            created_extract = True
            for info, name in zip(infos, names):
                mode = (info.external_attr >> 16) & 0o170000
                if mode == 0o120000:
                    raise PackageError(f"symlink member is not permitted: {name}")
                data = archive.read(info)
                expected = expected_entries[name]
                if len(data) != expected["bytes"] or sha256_bytes(data) != expected["sha256"]:
                    raise PackageError(f"archive member hash mismatch: {name}")
                target = (extract_dir / Path(*PurePosixPath(name).parts)).resolve()
                target.relative_to(extract_dir)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)

        package_dir = extract_dir / PACKAGE_ROOT
        internal_manifest = json.loads((package_dir / "SOURCE-MANIFEST.json").read_text(encoding="utf-8"))
        expected_internal = {
            "manifest_version": manifest["manifest_version"],
            "source_commit": manifest["source_commit"],
            "source_path": manifest["source_path"],
            "excluded_source_files": manifest["excluded_source_files"],
            "files": manifest["files"],
        }
        if internal_manifest != expected_internal:
            raise PackageError("internal source manifest differs from adjacent manifest")

        lab_dir = package_dir / "lab"
        for record in manifest["files"]:
            path = extract_dir / Path(*PurePosixPath(record["archive_path"]).parts)
            data = path.read_bytes()
            if len(data) != record["bytes"] or sha256_bytes(data) != record["sha256"]:
                raise PackageError(f"extracted source hash mismatch: {record['source_path']}")

        missing_links, repository_only = link_targets(package_dir)
        report["links"] = {
            "status": "PASS" if not missing_links else "FAIL",
            "missing": missing_links,
            "repository_only_references": repository_only,
        }
        if missing_links:
            raise PackageError(f"unresolved package-relative Markdown links: {missing_links}")

        for label, (module,), expected in FOCUSED_COMMANDS:
            report["commands"].append(run_test(lab_dir, label, (module, "-v"), expected))
        report["commands"].append(
            run_test(
                lab_dir,
                "ALL",
                ("discover", "-s", ".", "-p", "test_*.py", "-v"),
                sum(item[2] for item in FOCUSED_COMMANDS),
            )
        )
        report["cleanup"]["child_processes"] = "all test subprocesses exited"
        failed = [item for item in report["commands"] if item["status"] != "PASS"]
        if failed:
            raise PackageError(f"offline test verification failed: {failed}")
        report["status"] = "PASS"
    except Exception as error:  # Report and cleanup are part of the verification contract.
        failure = error
        report["error"] = str(error)
    finally:
        if created_extract and extract_dir.exists():
            shutil.rmtree(extract_dir)
        report["cleanup"]["extraction_removed"] = not extract_dir.exists()
        write_new(report_path, json_bytes(report))

    if failure is not None:
        raise PackageError(f"verification failed; report written to {report_path}: {failure}")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    build_parser = subparsers.add_parser("build", help="build a deterministic ZIP and adjacent manifest")
    build_parser.add_argument("--output-dir", type=Path, required=True)

    verify_parser = subparsers.add_parser("verify", help="extract, link-check, run tests, and clean up")
    verify_parser.add_argument("--archive", type=Path, required=True)
    verify_parser.add_argument("--manifest", type=Path, required=True)
    verify_parser.add_argument("--extract-dir", type=Path, required=True)
    verify_parser.add_argument("--report", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        result = build(args.output_dir) if args.command == "build" else verify(
            args.archive, args.manifest, args.extract_dir, args.report
        )
    except (PackageError, OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
