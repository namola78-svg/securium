"""Intentionally vulnerable M04 examples."""

from __future__ import annotations

from pathlib import Path
from urllib import request


def read_file_vulnerable(base_dir: Path, requested_name: str) -> str:
    """Vulnerable: a client path is joined and read without containment."""

    return (Path(base_dir) / requested_name).read_text(encoding="utf-8")


def store_upload_vulnerable(
    upload_dir: Path,
    client_filename: str,
    content: bytes,
) -> Path:
    """Vulnerable: client metadata selects the storage path."""

    destination = Path(upload_dir) / client_filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return destination


def fetch_url_vulnerable(
    url: str,
    opener: request.OpenerDirector | None = None,
    timeout: float = 2.0,
) -> bytes:
    """Vulnerable: request input controls the server-side destination."""

    active_opener = opener or request.build_opener()
    with active_opener.open(url, timeout=timeout) as response:
        return response.read()
