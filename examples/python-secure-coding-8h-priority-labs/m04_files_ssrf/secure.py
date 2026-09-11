"""Reference repairs for the M04 teaching fixtures."""

from __future__ import annotations

import ipaddress
import secrets
import socket
from pathlib import Path
from urllib import error, parse, request


class SecurityBoundaryError(ValueError):
    """The requested operation violates a local security policy."""


def resolve_under(base_dir: Path, requested_name: str) -> Path:
    """Resolve a candidate and require final containment under the base."""

    base = Path(base_dir).resolve()
    candidate = (base / requested_name).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as boundary_error:
        raise SecurityBoundaryError("path escapes the authorized base") from boundary_error
    return candidate


def read_file_secure(base_dir: Path, requested_name: str) -> str:
    return resolve_under(base_dir, requested_name).read_text(encoding="utf-8")


def store_upload_secure(
    upload_dir: Path,
    content: bytes,
    declared_type: str,
    max_bytes: int = 1024 * 1024,
) -> Path:
    """Use a generated name and require a small content/type policy."""

    if len(content) > max_bytes:
        raise SecurityBoundaryError("upload exceeds size limit")
    if declared_type == "text/plain":
        try:
            decoded = content.decode("utf-8")
        except UnicodeDecodeError as decode_error:
            raise SecurityBoundaryError("text upload is not valid UTF-8") from decode_error
        if "\x00" in decoded:
            raise SecurityBoundaryError("text upload contains a NUL byte")
    elif declared_type == "image/png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise SecurityBoundaryError("PNG signature is missing")
    else:
        raise SecurityBoundaryError("unsupported upload type")

    generated_name = f"upload-{secrets.token_hex(12)}.data"
    destination = resolve_under(Path(upload_dir), generated_name)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return destination


class _NoRedirectHandler(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        raise SecurityBoundaryError("redirects require a separate approved destination check")


def _resolve_addresses(hostname: str, port: int):
    return socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)


def _validate_destination(
    url: str,
    allowed_hosts: set[str],
    resolver,
) -> tuple[parse.SplitResult, int]:
    parsed = parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise SecurityBoundaryError("only an HTTP(S) hostname is allowed")
    if parsed.username is not None or parsed.password is not None:
        raise SecurityBoundaryError("userinfo in a URL is not allowed")
    hostname = parsed.hostname.lower().rstrip(".")
    if hostname not in {host.lower().rstrip(".") for host in allowed_hosts}:
        raise SecurityBoundaryError("destination host is not allowlisted")
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as port_error:
        raise SecurityBoundaryError("invalid destination port") from port_error
    if port not in {80, 443}:
        raise SecurityBoundaryError("destination port is not allowed")

    addresses = resolver(hostname, port)
    if not addresses:
        raise SecurityBoundaryError("destination did not resolve")
    for address in addresses:
        raw_ip = address[4][0]
        ip = ipaddress.ip_address(raw_ip)
        if not ip.is_global:
            raise SecurityBoundaryError("destination resolves to a non-global address")
    return parsed, port


def fetch_url_secure(
    url: str,
    allowed_hosts: set[str],
    resolver=_resolve_addresses,
    opener: request.OpenerDirector | None = None,
    timeout: float = 2.0,
    max_bytes: int = 64 * 1024,
) -> bytes:
    """Apply host/address/redirect/timeout/response-size policy before fetch."""

    parsed, _ = _validate_destination(url, allowed_hosts, resolver)
    active_opener = opener or request.build_opener(_NoRedirectHandler())
    http_request = request.Request(url, method="GET")
    try:
        response = active_opener.open(http_request, timeout=timeout)
    except error.HTTPError as fetch_error:
        raise SecurityBoundaryError("approved fetch returned an HTTP error") from fetch_error

    try:
        final_url = response.geturl()
        final_parsed, _ = _validate_destination(final_url, allowed_hosts, resolver)
        if final_parsed.hostname != parsed.hostname:
            raise SecurityBoundaryError("response destination changed")
        body = response.read(max_bytes + 1)
        if len(body) > max_bytes:
            raise SecurityBoundaryError("response exceeds size limit")
        return body
    finally:
        response.close()
