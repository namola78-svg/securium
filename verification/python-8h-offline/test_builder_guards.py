#!/usr/bin/env python3
"""Small regression checks for archive path safety guards."""

from __future__ import annotations

from pathlib import Path
import runpy


BUILDER = Path(__file__).with_name("build_offline_package.py")
namespace = runpy.run_path(str(BUILDER))
PackageError = namespace["PackageError"]
safe_member_name = namespace["safe_member_name"]
validate_archive_member_names = namespace["validate_archive_member_names"]


def must_reject(value: str) -> None:
    try:
        safe_member_name(value)
    except PackageError:
        return
    raise AssertionError(f"unsafe archive member was accepted: {value!r}")


for unsafe in (
    "../escape.txt",
    "/absolute.txt",
    "C:drive.txt",
    "folder\\mixed-separator.txt",
    "folder/CON.txt",
    "folder/name. ",
    "folder/name?.txt",
):
    must_reject(unsafe)

for colliding in (
    ["package/A.txt", "package/a.txt"],
    ["package/e\u0301.txt", "package/é.txt"],
):
    try:
        validate_archive_member_names(colliding)
    except PackageError:
        pass
    else:
        raise AssertionError(f"archive collision was accepted: {colliding!r}")

assert validate_archive_member_names(["package/README.md"]) == ["package/README.md"]
print("builder_guard_regression=PASS")
