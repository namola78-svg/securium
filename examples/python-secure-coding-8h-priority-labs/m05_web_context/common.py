from __future__ import annotations

from dataclasses import dataclass, field
import http.server
import json
from threading import Thread
from typing import Mapping
from urllib.parse import parse_qs, urlsplit


TRUSTED_ORIGIN = "https://app.local"
ALLOWED_THEMES = frozenset({"light", "dark"})
FIXTURE_DEBUG_SECRET = "fixture-debug-secret-do-not-log"


class ClientInputError(ValueError):
    """An input that does not satisfy the service contract."""


@dataclass
class SessionRecord:
    session_id: str
    csrf_token: str
    theme: str = "light"


@dataclass
class ServiceState:
    sessions: dict[str, SessionRecord] = field(default_factory=dict)
    logs: list[str] = field(default_factory=list)


@dataclass
class ServiceResponse:
    status: int
    payload: dict[str, object]


def demo_state() -> ServiceState:
    """Return fresh fake sessions for one isolated test server."""

    return ServiceState(
        sessions={
            "alice": SessionRecord("alice", "alice-csrf-token"),
            "bob": SessionRecord("bob", "bob-csrf-token"),
        }
    )


def make_response(status: int, **payload: object) -> ServiceResponse:
    return ServiceResponse(status=status, payload=payload)


def header_value(headers: Mapping[str, str], name: str) -> str | None:
    wanted = name.casefold()
    for key, value in headers.items():
        if key.casefold() == wanted:
            return value
    return None


def cookie_value(headers: Mapping[str, str], name: str) -> str | None:
    raw = header_value(headers, "Cookie") or ""
    for item in raw.split(";"):
        key, separator, value = item.strip().partition("=")
        if separator and key == name:
            return value
    return None


def query_value(request_target: str, name: str) -> str:
    values = parse_qs(urlsplit(request_target).query, keep_blank_values=True).get(name)
    return values[0] if values else ""


def json_object(body: bytes) -> dict[str, object]:
    try:
        decoded = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ClientInputError("request body is not valid JSON") from error
    if not isinstance(decoded, dict):
        raise ClientInputError("request body must be a JSON object")
    return decoded


class _ReusableThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class LocalServiceServer:
    """Run a teaching service on an ephemeral loopback-only TCP port."""

    def __init__(self, service: object) -> None:
        self.service = service
        self.server: _ReusableThreadingHTTPServer | None = None
        self.thread: Thread | None = None

    def __enter__(self) -> "LocalServiceServer":
        service = self.service

        class Handler(http.server.BaseHTTPRequestHandler):
            def _dispatch(self) -> None:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length)
                headers = {key: value for key, value in self.headers.items()}
                response = service.handle(  # type: ignore[attr-defined]
                    self.command, self.path, headers, body
                )
                encoded = json.dumps(
                    response.payload, ensure_ascii=False, sort_keys=True
                ).encode("utf-8")
                self.send_response(response.status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

            def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
                self._dispatch()

            def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
                self._dispatch()

            def log_message(self, format: str, *args: object) -> None:
                return

        self.server = _ReusableThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return self

    @property
    def port(self) -> int:
        if self.server is None:
            raise RuntimeError("server is not running")
        return int(self.server.server_address[1])

    def url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}{path}"

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        if self.server is not None:
            self.server.shutdown()
            self.server.server_close()
        if self.thread is not None:
            self.thread.join(timeout=2)
