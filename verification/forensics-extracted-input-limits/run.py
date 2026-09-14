"""Validate input byte limits in the source-bound extracted timeline lab."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile
import zipfile
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_RELATIVE = Path("examples/digital-forensics-timeline-offline-package")
BUILDER_RELATIVE = PACKAGE_RELATIVE / "build_offline_package.py"
EXISTING_CI_RUNNER_RELATIVE = PACKAGE_RELATIVE / "ci_matrix_check.py"
LAB_RELATIVE = Path("examples/digital-forensics-timeline-local-lab")
TIMELINE_SOURCE = LAB_RELATIVE / "timeline_lab.py"
MAX_INPUT_BYTES = 1_048_576
OVERFLOW_BYTES = MAX_INPUT_BYTES + 1
SUBPROCESS_TIMEOUT_SECONDS = 30
TRUSTED_SOURCE_COMMIT = "200e3db5a191eae2db82e8f4a426f0fcbf24f69e"
FIXED_ANALYSIS_TIME = "2026-09-14T00:00:00Z"


class RunnerFailure(RuntimeError):
    """A classified failure in the focused extracted-package run."""

    def __init__(self, stage: str, message: str) -> None:
        super().__init__(message)
        self.stage = stage


def _clean_environment(temp_root: Path) -> dict[str, str]:
    environment = os.environ.copy()
    for key in list(environment):
        if key.upper() in {"PYTHONPATH", "PYTHONHOME"}:
            environment.pop(key, None)
    for key in ("TMPDIR", "TEMP", "TMP"):
        environment[key] = str(temp_root)
    return environment


def _run(
    command: list[str],
    *,
    cwd: Path,
    environment: dict[str, str],
    stage: str,
    timeout: int = SUBPROCESS_TIMEOUT_SECONDS,
    expected_code: int | None = None,
) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            shell=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as error:
        raise RunnerFailure(stage, f"subprocess timeout after {timeout}s") from error
    except OSError as error:
        raise RunnerFailure(stage, f"subprocess error: {type(error).__name__}") from error
    if expected_code is not None and result.returncode != expected_code:
        detail = result.stderr.strip() or result.stdout.strip() or "no command output"
        raise RunnerFailure(
            stage,
            f"unexpected exit {result.returncode}; expected {expected_code}: {detail[-1200:]}",
        )
    return result


def _git_output(root: Path, *arguments: str) -> str:
    try:
        completed = subprocess.run(
            ["git", "-C", str(root), *arguments],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            shell=False,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as error:
        raise RunnerFailure(
            "trusted_source_checkout",
            f"git subprocess timeout after {SUBPROCESS_TIMEOUT_SECONDS}s",
        ) from error
    except OSError as error:
        raise RunnerFailure("trusted_source_checkout", f"git subprocess error: {type(error).__name__}") from error
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "git command failed"
        raise RunnerFailure("trusted_source_checkout", detail[-1200:])
    return completed.stdout.strip()


def _git_bytes(root: Path, *arguments: str) -> bytes:
    try:
        completed = subprocess.run(
            ["git", "-C", str(root), *arguments],
            capture_output=True,
            check=False,
            shell=False,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as error:
        raise RunnerFailure(
            "trusted_source_checkout",
            f"git subprocess timeout after {SUBPROCESS_TIMEOUT_SECONDS}s",
        ) from error
    except OSError as error:
        raise RunnerFailure("trusted_source_checkout", f"git subprocess error: {type(error).__name__}") from error
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise RunnerFailure("trusted_source_checkout", detail[-1200:] or "git command failed")
    return completed.stdout


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        while block := handle.read(1024 * 1024):
            size += len(block)
            digest.update(block)
    return size, digest.hexdigest()


def _write_new(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(data)


def _fixture() -> dict[str, Any]:
    return {
        "format": "securium-digital-forensics-timeline-local-lab-v1",
        "scope": "synthetic-local-only",
        "fixture_id": "extracted-input-limit-v1",
        "fixture_created_at": "2026-09-14T00:00:00Z",
        "records": [
            {
                "event_id": "limit-event-001",
                "source_id": "synthetic-source-alpha",
                "synthetic_file_id": "synthetic-file-alpha",
                "event_type": "observed",
                "timestamp_original": "2026-09-13T09:00:00Z",
                "timestamp_meaning": "source-reported synthetic observation",
                "notes": "Synthetic input only; no real evidence.",
            }
        ],
        "limitations": [
            "This fixture is synthetic and does not establish causality or authenticity."
        ],
    }


def _fixture_bytes(padding: int = 0) -> bytes:
    fixture = _fixture()
    fixture["limitations"] = ["x" * padding]
    return json.dumps(fixture, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8")


def _exact_fixture_bytes(size: int) -> bytes:
    base_size = len(_fixture_bytes())
    padding = size - base_size
    if padding < 0:
        raise RunnerFailure("fixture", f"fixture base exceeds requested size {size}")
    data = _fixture_bytes(padding)
    if len(data) != size:
        raise RunnerFailure("fixture", f"fixture size was {len(data)}; expected {size}")
    return data


def _json_output(result: subprocess.CompletedProcess[str], stage: str) -> dict[str, Any]:
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RunnerFailure(stage, "CLI did not return a JSON object") from error
    if not isinstance(value, dict):
        raise RunnerFailure(stage, "CLI JSON result is not an object")
    return value


def _load_module(path: Path, name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RunnerFailure("trusted_source_checkout", f"could not load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _read_probe(module_path: Path, placeholder: Path, execution_cwd: Path, temp_root: Path) -> dict[str, Any]:
    probe = r'''
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from unittest.mock import patch

module_path = Path(sys.argv[1]).resolve()
placeholder = Path(sys.argv[2]).resolve()
repository_root = Path(sys.argv[3]).resolve()
maximum = int(sys.argv[4])
spec = importlib.util.spec_from_file_location("extracted_timeline_lab_probe", module_path)
if spec is None or spec.loader is None:
    raise AssertionError("module spec was not created")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if Path(module.__file__).resolve() != module_path:
    raise AssertionError("module.__file__ did not identify the extracted file")
try:
    module_path.relative_to(repository_root)
except ValueError:
    pass
else:
    raise AssertionError("repository timeline source was imported")

class TrackingBytes(bytes):
    def __new__(cls, value, stream):
        instance = super().__new__(cls, value)
        instance.stream = stream
        return instance

    def decode(self, *args, **kwargs):
        self.stream.decode_calls += 1
        return super().decode(*args, **kwargs)

class InstrumentedBinaryStream:
    def __init__(self, payload, read_error=None):
        self.payload = payload
        self.read_error = read_error
        self.read_sizes = []
        self.consumed = 0
        self.decode_calls = 0
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
        return False

    def read(self, size=-1):
        self.read_sizes.append(size)
        if self.read_error is not None:
            raise self.read_error
        chunk = self.payload if size < 0 else self.payload[:size]
        self.consumed += len(chunk)
        return TrackingBytes(chunk, self)

    def close(self):
        self.closed = True

valid = json.dumps({
    "format": "securium-digital-forensics-timeline-local-lab-v1",
    "scope": "synthetic-local-only",
    "fixture_id": "double-probe",
    "fixture_created_at": "2026-09-14T00:00:00Z",
    "records": [{
        "event_id": "double-event",
        "source_id": "synthetic-source",
        "synthetic_file_id": "synthetic-file",
        "event_type": "observed",
        "timestamp_original": "2026-09-13T09:00:00Z",
        "timestamp_meaning": "synthetic observation",
        "notes": "synthetic",
    }],
}).encode("utf-8")

success_stream = InstrumentedBinaryStream(valid)
with patch.object(module.Path, "open", return_value=success_stream):
    success = module.analyze_file(placeholder, "2026-09-14T00:00:00Z")
if success_stream.read_sizes != [maximum + 1] or success_stream.consumed != len(valid):
    raise AssertionError("success read budget was not MAX_INPUT_BYTES + 1")
if success_stream.decode_calls != 1 or not success_stream.closed:
    raise AssertionError("success decode/close contract failed")

overflow_stream = InstrumentedBinaryStream(b"x" * (maximum + 1))
with patch.object(module.json, "loads", side_effect=AssertionError("JSON parser must not run")) as parser:
    with patch.object(module.Path, "open", return_value=overflow_stream):
        try:
            module.analyze_file(placeholder, "2026-09-14T00:00:00Z")
        except module.LabError as error:
            if "input exceeds the 1048576-byte limit" not in str(error):
                raise AssertionError("overflow error contract changed")
        else:
            raise AssertionError("overflow input unexpectedly succeeded")
if overflow_stream.read_sizes != [maximum + 1] or overflow_stream.consumed != maximum + 1:
    raise AssertionError("overflow did not use the bounded read")
if overflow_stream.decode_calls != 0 or parser.call_count != 0 or not overflow_stream.closed:
    raise AssertionError("overflow decode/parser/close contract failed")

read_error_stream = InstrumentedBinaryStream(b"unused", OSError("injected read failure"))
with patch.object(module.Path, "open", return_value=read_error_stream):
    try:
        module.analyze_file(placeholder, "2026-09-14T00:00:00Z")
    except module.LabError as error:
        if "could not read input" not in str(error):
            raise AssertionError("read-error contract changed")
    else:
        raise AssertionError("read error unexpectedly succeeded")
if read_error_stream.read_sizes != [maximum + 1] or not read_error_stream.closed:
    raise AssertionError("read-error close/budget contract failed")

print(json.dumps({
    "module_file": str(Path(module.__file__).resolve()),
    "repository_source_imported": False,
    "success": {"read_sizes": success_stream.read_sizes, "decode_calls": success_stream.decode_calls, "closed": success_stream.closed},
    "overflow": {"read_sizes": overflow_stream.read_sizes, "consumed": overflow_stream.consumed, "decode_calls": overflow_stream.decode_calls, "parser_calls": parser.call_count, "closed": overflow_stream.closed},
    "read_error": {"read_sizes": read_error_stream.read_sizes, "decode_calls": read_error_stream.decode_calls, "closed": read_error_stream.closed},
    "valid_input_sha256": hashlib.sha256(valid).hexdigest(),
}, sort_keys=True))
'''
    result = _run(
        [
            sys.executable,
            "-B",
            "-c",
            probe,
            str(module_path),
            str(placeholder),
            str(REPOSITORY_ROOT),
            str(MAX_INPUT_BYTES),
        ],
        cwd=execution_cwd,
        environment=_clean_environment(temp_root),
        stage="read_budget_test_double",
    )
    return _json_output(result, "read_budget_test_double")


def _evaluate_extracted_cli(
    *,
    cli_path: Path,
    execution_cwd: Path,
    temp_root: Path,
) -> dict[str, Any]:
    environment = _clean_environment(temp_root)
    normal_input = temp_root / "normal input.json"
    normal_report = temp_root / "normal report.json"
    exact_input = temp_root / "exact input.json"
    exact_report = temp_root / "exact report.json"
    overflow_input = temp_root / "overflow input.json"
    overflow_report = temp_root / "overflow report.json"
    sentinel = temp_root / "external sentinel.txt"

    normal_bytes = _fixture_bytes()
    exact_bytes = _exact_fixture_bytes(MAX_INPUT_BYTES)
    overflow_bytes = _exact_fixture_bytes(OVERFLOW_BYTES)
    _write_new(normal_input, normal_bytes)
    _write_new(exact_input, exact_bytes)
    _write_new(overflow_input, overflow_bytes)
    _write_new(sentinel, b"must remain unchanged\n")

    def cli(input_path: Path, output_path: Path) -> subprocess.CompletedProcess[str]:
        return _run(
            [
                sys.executable,
                "-B",
                str(cli_path.resolve()),
                "analyze",
                "--input",
                str(input_path.resolve()),
                "--output",
                str(output_path.resolve()),
                "--analysis-run-at",
                FIXED_ANALYSIS_TIME,
            ],
            cwd=execution_cwd,
            environment=environment,
            stage="extracted_cli_evaluation",
        )

    normal_result = cli(normal_input, normal_report)
    if normal_result.returncode != 0:
        raise RunnerFailure("extracted_cli_evaluation", "normal extracted CLI input failed")
    normal_payload = _json_output(normal_result, "extracted_cli_evaluation")
    normal_hash = _sha256(normal_bytes)
    if (
        normal_payload.get("status") != "ANALYZED"
        or normal_payload.get("record_count") != 1
        or normal_payload.get("input_sha256") != normal_hash
    ):
        raise RunnerFailure("extracted_cli_evaluation", "normal extracted CLI result was unexpected")
    if not normal_report.is_file() or _sha256_file(normal_input) != (len(normal_bytes), normal_hash):
        raise RunnerFailure("extracted_cli_evaluation", "normal input/report preservation failed")

    exact_result = cli(exact_input, exact_report)
    if exact_result.returncode != 0:
        raise RunnerFailure("extracted_cli_evaluation", "exact-limit extracted CLI input failed")
    exact_payload = _json_output(exact_result, "extracted_cli_evaluation")
    if exact_payload.get("status") != "ANALYZED" or exact_payload.get("record_count") != 1:
        raise RunnerFailure("extracted_cli_evaluation", "exact-limit extracted CLI result was unexpected")
    exact_hash = _sha256(exact_bytes)
    if (
        len(exact_bytes) != MAX_INPUT_BYTES
        or exact_payload.get("input_sha256") != exact_hash
        or not exact_report.is_file()
        or _sha256_file(exact_input) != (MAX_INPUT_BYTES, exact_hash)
    ):
        raise RunnerFailure("extracted_cli_evaluation", "exact byte-limit acceptance contract failed")

    overflow_hash = _sha256(overflow_bytes)
    overflow_result = cli(overflow_input, overflow_report)
    if overflow_result.returncode != 2:
        raise RunnerFailure(
            "extracted_cli_evaluation",
            f"overflow input returned {overflow_result.returncode}; expected 2",
        )
    error_text = overflow_result.stderr
    if "input exceeds the 1048576-byte limit" not in error_text:
        raise RunnerFailure("extracted_cli_evaluation", "overflow error contract was not observed")
    if overflow_report.exists() or _sha256_file(overflow_input) != (OVERFLOW_BYTES, overflow_hash):
        raise RunnerFailure("extracted_cli_evaluation", "overflow report/input preservation failed")
    if sentinel.read_bytes() != b"must remain unchanged\n":
        raise RunnerFailure("extracted_cli_evaluation", "external sentinel changed")

    return {
        "normal": {
            "exit_code": normal_result.returncode,
            "input_bytes": len(normal_bytes),
            "input_sha256": normal_hash,
            "report_created": normal_report.is_file(),
            "record_count": normal_payload["record_count"],
            "tie_group_count": normal_payload["tie_group_count"],
            "potential_conflict_count": normal_payload["potential_conflict_count"],
        },
        "exact_limit": {
            "exit_code": exact_result.returncode,
            "input_bytes": len(exact_bytes),
            "input_sha256": exact_hash,
            "report_created": exact_report.is_file(),
            "record_count": exact_payload["record_count"],
        },
        "overflow": {
            "exit_code": overflow_result.returncode,
            "input_bytes": len(overflow_bytes),
            "input_sha256": overflow_hash,
            "error_contract": "input exceeds the 1048576-byte limit",
            "report_created": overflow_report.exists(),
            "input_preserved": True,
            "external_sentinel_preserved": True,
        },
        "output_paths_separate": True,
    }


def run_validation(trusted_source_commit: str) -> dict[str, Any]:
    task = tempfile.TemporaryDirectory(prefix="securium-forensics-extracted-input-limits-")
    task_root = Path(task.name)
    trusted_root = task_root / "trusted source"
    artifact_root = task_root / "artifacts"
    extraction_root = task_root / "verified extraction 한글"
    execution_cwd = task_root / "execution cwd"
    execution_cwd.mkdir()
    placeholder = task_root / "read-probe placeholder.json"
    _write_new(placeholder, b"placeholder")
    worktree_added = False
    primary_error: BaseException | None = None
    try:
        _run(
            [
                "git",
                "-C",
                str(REPOSITORY_ROOT),
                "worktree",
                "add",
                "--detach",
                "--no-checkout",
                str(trusted_root),
                trusted_source_commit,
            ],
            cwd=REPOSITORY_ROOT,
            environment=_clean_environment(task_root),
            stage="trusted_source_checkout",
        )
        worktree_added = True
        _run(
            ["git", "-C", str(trusted_root), "config", "core.autocrlf", "false"],
            cwd=REPOSITORY_ROOT,
            environment=_clean_environment(task_root),
            stage="trusted_source_checkout",
        )
        _run(
            ["git", "-C", str(trusted_root), "config", "core.eol", "lf"],
            cwd=REPOSITORY_ROOT,
            environment=_clean_environment(task_root),
            stage="trusted_source_checkout",
        )
        _run(
            ["git", "-C", str(trusted_root), "checkout", "--force", "--detach", trusted_source_commit],
            cwd=REPOSITORY_ROOT,
            environment=_clean_environment(task_root),
            stage="trusted_source_checkout",
        )
        if _git_output(trusted_root, "rev-parse", "HEAD") != trusted_source_commit:
            raise RunnerFailure("trusted_source_checkout", "trusted checkout SHA mismatch")
        if _git_output(trusted_root, "status", "--porcelain", "--untracked-files=all"):
            raise RunnerFailure("trusted_source_checkout", "trusted checkout is not clean")

        builder_path = trusted_root / BUILDER_RELATIVE
        builder = _load_module(builder_path, "trusted_timeline_package_builder")
        package_ci = _load_module(
            trusted_root / EXISTING_CI_RUNNER_RELATIVE,
            "trusted_timeline_package_ci_runner",
        )

        build_result = builder.build_package(
            trusted_root,
            artifact_root,
            source_commit=trusted_source_commit,
            require_clean=True,
        )
        if (
            build_result.get("status") != "BUILT"
            or build_result.get("source_commit") != trusted_source_commit
            or build_result.get("source_entry_count") != len(builder.PACKAGE_ALLOWLIST)
            or build_result.get("source_entry_count") != 13
            or build_result.get("entry_count") != 14
        ):
            raise RunnerFailure("package_build", "package counts or source commit did not match the fixed contract")

        zip_path = Path(str(build_result["zip_path"]))
        manifest_path = Path(str(build_result["external_manifest_path"]))
        package_report = task_root / "source-bound verification report.json"
        verification = builder.verify_package(
            zip_path,
            manifest_path,
            extract_dir=extraction_root,
            report_path=package_report,
            trusted_repository_root=trusted_root,
            trusted_source_commit=trusted_source_commit,
        )
        if (
            verification.get("status") != "PASS"
            or verification.get("source_verification") != "PASS"
            or verification.get("trusted_source_commit") != trusted_source_commit
            or verification.get("source_entry_count") != 13
            or verification.get("entry_count") != 14
            or not extraction_root.is_dir()
        ):
            raise RunnerFailure("source_bound_verification", "source-bound package verification did not pass")

        with zipfile.ZipFile(zip_path, "r") as archive:
            internal = json.loads(archive.read("package-manifest.json").decode("utf-8"))
        timeline_archive = f"{LAB_RELATIVE.as_posix()}/timeline_lab.py"
        entry = next(
            item for item in internal["entries"] if item.get("archive_path") == timeline_archive
        )
        extracted_timeline = extraction_root / TIMELINE_SOURCE
        extracted_bytes = extracted_timeline.read_bytes()
        source_bytes = _git_bytes(
            trusted_root,
            "cat-file",
            "blob",
            f"{trusted_source_commit}:{TIMELINE_SOURCE.as_posix()}",
        )
        source_blob_sha1 = _git_output(
            trusted_root,
            "rev-parse",
            f"{trusted_source_commit}:{TIMELINE_SOURCE.as_posix()}",
        )
        source_sha256 = _sha256(source_bytes)
        if extracted_bytes != source_bytes:
            raise RunnerFailure("extraction_provenance", "extracted timeline bytes differ from trusted Git bytes")
        if (
            entry.get("source_path") != TIMELINE_SOURCE.as_posix()
            or entry.get("size") != len(source_bytes)
            or entry.get("sha256") != source_sha256
            or entry.get("git_blob_sha1") != source_blob_sha1
        ):
            raise RunnerFailure("extraction_provenance", "timeline manifest provenance did not match trusted source")

        try:
            preflight = package_ci._run_extracted_preflight(extraction_root, task_root)
        except Exception as error:
            raise RunnerFailure("extracted_preflight", str(error)) from error
        if (
            preflight.get("overall_status") != "PASS"
            or preflight.get("exit_code") != 0
            or preflight.get("probe_counts") != {"NOT_RUN": 6, "PASS": 8}
            or preflight.get("lab_execution") != "PENDING"
        ):
            raise RunnerFailure("extracted_preflight", "preflight result did not match its separate contract")

        cli_result = _evaluate_extracted_cli(
            cli_path=extraction_root / LAB_RELATIVE / "cli.py",
            execution_cwd=execution_cwd,
            temp_root=task_root,
        )
        read_probe = _read_probe(
            extraction_root / TIMELINE_SOURCE,
            placeholder,
            execution_cwd,
            task_root,
        )

        zip_size, zip_hash = _sha256_file(zip_path)
        return {
            "status": "PASS",
            "trusted_source_commit": trusted_source_commit,
            "trusted_source_tree": verification.get("trusted_source_tree"),
            "package_source_entry_count": build_result["source_entry_count"],
            "package_zip_entry_count": build_result["entry_count"],
            "zip_bytes": zip_size,
            "zip_sha256": zip_hash,
            "manifest_source_entry": entry,
            "timeline_source_path": TIMELINE_SOURCE.as_posix(),
            "timeline_source_git_blob_sha1": entry["git_blob_sha1"],
            "timeline_source_sha256": source_sha256,
            "extracted_timeline_path": str(extracted_timeline.resolve()),
            "extracted_timeline_sha256": _sha256(extracted_bytes),
            "extraction_source_bytes_match": True,
            "source_binding": {
                "trusted_source_commit": trusted_source_commit,
                "trusted_source_tree": verification.get("trusted_source_tree"),
                "source_path": TIMELINE_SOURCE.as_posix(),
                "trusted_git_blob_sha1": source_blob_sha1,
                "trusted_source_sha256": source_sha256,
                "zip_entry": {
                    "archive_path": entry["archive_path"],
                    "source_path": entry["source_path"],
                    "size": entry["size"],
                    "sha256": entry["sha256"],
                    "git_blob_sha1": entry["git_blob_sha1"],
                },
                "extracted_path": str(extracted_timeline.resolve()),
                "extracted_sha256": _sha256(extracted_bytes),
                "extracted_bytes_match": True,
            },
            "stages": {
                "source_verification": "PASS",
                "extraction": "PASS",
                "preflight": "PASS",
                "extracted_input_limits": "PASS",
                "strict_lab_execution": "NOT_RUN",
                "cleanup": "PENDING",
            },
            "preflight": preflight,
            "input_limit": cli_result,
            "read_budget_test_double": read_probe,
            "execution": {
                "cli_script": str((extraction_root / LAB_RELATIVE / "cli.py").resolve()),
                "timeline_module": str(extracted_timeline.resolve()),
                "cwd": str(execution_cwd.resolve()),
                "python": sys.version,
                "platform": platform.platform(),
                "pythonpath_removed": "PYTHONPATH" not in _clean_environment(task_root),
                "pythonhome_removed": "PYTHONHOME" not in _clean_environment(task_root),
                "subprocess_timeout_seconds": SUBPROCESS_TIMEOUT_SECONDS,
                "shell": False,
            },
            "owned_cleanup": "PENDING",
        }
    except BaseException as error:
        primary_error = error
        raise
    finally:
        cleanup_errors: list[BaseException] = []
        if worktree_added:
            try:
                _run(
                    ["git", "-C", str(REPOSITORY_ROOT), "worktree", "remove", "--force", str(trusted_root)],
                    cwd=REPOSITORY_ROOT,
                    environment=_clean_environment(task_root),
                    stage="owned_cleanup",
                )
            except BaseException as error:
                cleanup_errors.append(error)
        try:
            task.cleanup()
        except BaseException as error:
            cleanup_errors.append(error)
        if cleanup_errors:
            if primary_error is None:
                raise RunnerFailure(
                    "owned_cleanup",
                    "; ".join(str(error) for error in cleanup_errors),
                )
            for cleanup_error in cleanup_errors:
                print(f"owned_cleanup=SECONDARY_FAILURE reason={cleanup_error}", file=sys.stderr)
        elif primary_error is None:
            print("owned_cleanup=PASS", file=sys.stderr)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-commit", default=TRUSTED_SOURCE_COMMIT)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        if len(args.source_commit) != 40 or any(char not in "0123456789abcdef" for char in args.source_commit):
            raise RunnerFailure("trusted_source_checkout", "source commit must be a full lowercase SHA-1")
        summary = run_validation(args.source_commit)
    except RunnerFailure as error:
        print(
            "extracted_input_limit_validation="
            + json.dumps(
                {"status": "FAIL", "failed_stage": error.stage, "message": str(error)},
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 1
    except Exception as error:
        print(
            "extracted_input_limit_validation="
            + json.dumps(
                {"status": "FAIL", "failed_stage": "unexpected", "message": str(error)},
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 1
    summary["owned_cleanup"] = "PASS"
    summary["stages"]["cleanup"] = "PASS"
    print("extracted_input_limit_validation=" + json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
