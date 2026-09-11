from __future__ import annotations

import argparse
import http.server
import json
from pathlib import Path
import re
import ssl
import sys
from threading import Thread
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "examples" / "python-secure-coding-8h-priority-labs"))

from m05_web_context.common import (  # noqa: E402
    FIXTURE_DEBUG_SECRET,
    ServiceResponse,
    ServiceState,
    demo_state,
)
from m05_web_context.secure import (  # noqa: E402
    SecureService,
)
from m05_web_context.vulnerable import (  # noqa: E402
    VulnerableService,
)


HOSTS = ("app.local", "vuln.test", "attacker.test")
CLIENT_SECRET = "client-supplied-secret"


def safe_response_payload(response: ServiceResponse) -> dict[str, object]:
    payload = response.payload
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    safe: dict[str, object] = {
        "keys": sorted(payload),
        "contains_fixture_secret": FIXTURE_DEBUG_SECRET in serialized,
        "contains_query_secret": CLIENT_SECRET in serialized,
        "contains_traceback": "Traceback" in serialized,
    }
    if isinstance(payload.get("error"), str) and payload["error"] in {
        "invalid_request",
        "method_not_allowed",
        "authentication_required",
        "csrf_failed",
        "internal_error",
        "not_found",
    }:
        safe["error"] = payload["error"]
    for key in ("changed", "theme"):
        if key in payload and isinstance(payload[key], (bool, str)):
            safe[key] = payload[key]
    request_id = payload.get("request_id")
    if isinstance(request_id, str) and re.fullmatch(r"[0-9a-f]{12}", request_id):
        safe["request_id_present"] = True
    return safe


def service_log_flags(state: ServiceState) -> dict[str, object]:
    logs = "\n".join(state.logs)
    return {
        "log_count": len(state.logs),
        "contains_fixture_secret": FIXTURE_DEBUG_SECRET in logs,
        "contains_query_secret": CLIENT_SECRET in logs,
        "contains_traceback": "Traceback" in logs,
        "has_request_id": bool(re.search(r"request_id=[0-9a-f]{12}", logs)),
    }


class BrowserHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class Handler(http.server.BaseHTTPRequestHandler):
    server: BrowserHTTPServer

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_OPTIONS(self) -> None:  # noqa: N802 - stdlib handler API
        self._dispatch()

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        self._dispatch()

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
        self._dispatch()

    def _dispatch(self) -> None:
        if getattr(self.server, "static_only", False):
            self._attacker_page()
            return

        host = self.headers.get("Host", "").split(":", 1)[0].casefold()
        if host == "attacker.test":
            self._attacker_page()
            return

        service_name = {"app.local": "secure", "vuln.test": "vulnerable"}.get(host)
        if service_name is None:
            self._write_json(421, {"error": "misdirected_request"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        headers = {key: value for key, value in self.headers.items()}
        service = self.server.services[service_name]  # type: ignore[attr-defined]
        response = service.handle(self.command, self.path, headers, body)
        self._write_json(response.status, response.payload)

        request_headers = {key.casefold(): value for key, value in headers.items()}
        event = {
            "service": service_name,
            "host": host,
            "method": self.command,
            "path": urlsplit(self.path).path,
            "origin": request_headers.get("origin"),
            "cookie_present": bool(request_headers.get("cookie")),
            "content_type": request_headers.get("content-type"),
            "csrf_header_present": bool(request_headers.get("x-csrf-token")),
            "sec_fetch_site": request_headers.get("sec-fetch-site"),
            "status": response.status,
            "response": safe_response_payload(response),
        }
        print("EVENT " + json.dumps(event, sort_keys=True), flush=True)

    def _attacker_page(self) -> None:
        protocol = self.server.protocol  # type: ignore[attr-defined]
        service_port = self.server.service_port  # type: ignore[attr-defined]
        default_port = 443 if protocol == "https" else 80
        port_suffix = "" if service_port == default_port else f":{service_port}"
        secure_action = f"{protocol}://app.local{port_suffix}/settings/theme"
        vulnerable_action = f"{protocol}://vuln.test{port_suffix}/settings/theme"
        body = f"""<!doctype html>
<meta charset="utf-8">
<title>M05 isolated attacker fixture</title>
<h1>M05 isolated attacker fixture</h1>
<form id="secure-form" action="{secure_action}" method="POST" enctype="application/x-www-form-urlencoded" target="result-frame">
  <input name="theme" value="dark"><button type="submit">Submit secure form</button>
</form>
<form id="vulnerable-form" action="{vulnerable_action}" method="POST" enctype="application/x-www-form-urlencoded" target="result-frame">
  <input name="theme" value="dark"><button type="submit">Submit vulnerable form</button>
</form>
<iframe name="result-frame" title="form result"></iframe>
""".encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _write_json(self, status: int, payload: dict[str, object]) -> None:
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def state_snapshot(services: dict[str, object], name: str) -> dict[str, object]:
    service = services[name]
    state = service.state  # type: ignore[attr-defined]
    return {
        "service": name,
        "alice_theme": state.sessions["alice"].theme,
        "bob_theme": state.sessions["bob"].theme,
        "logs": service_log_flags(state),
    }


def command_loop(servers: list[BrowserHTTPServer], services: dict[str, object]) -> None:
    for line in sys.stdin:
        command = line.strip()
        if command == "STOP":
            for server in servers:
                server.shutdown()
            return
        if command.startswith("STATE "):
            name = command.removeprefix("STATE ").strip()
            if name in services:
                print("STATE " + json.dumps(state_snapshot(services, name), sort_keys=True), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("http", "https"), default="http")
    parser.add_argument("--port", type=int, default=80)
    parser.add_argument("--attacker-port", type=int, default=8080)
    parser.add_argument("--runtime-dir", required=True)
    parser.add_argument("--cert-path")
    parser.add_argument("--key-path")
    args = parser.parse_args()
    runtime_dir = Path(args.runtime_dir)
    runtime_dir.mkdir(parents=True, exist_ok=True)
    protocol = args.mode
    cert_path = key_path = None
    thumbprint = None
    if args.mode == "https":
        if not args.cert_path or not args.key_path:
            print(
                "START_ERROR "
                + json.dumps({"reason": "https mode requires caller-supplied trusted certificate and key; no trust-store mutation is attempted"}),
                flush=True,
            )
            return 2
        cert_path = Path(args.cert_path)
        key_path = Path(args.key_path)
        secure_trusted_origin = f"https://app.local"
    else:
        secure_trusted_origin = f"http://app.local"

    services: dict[str, object] = {
        "secure": SecureService(demo_state(), trusted_origin=secure_trusted_origin),
        "vulnerable": VulnerableService(demo_state()),
    }
    servers: list[BrowserHTTPServer] = []
    try:
        server = BrowserHTTPServer(("127.0.0.1", args.port), Handler)
        servers.append(server)
        if args.mode == "http":
            attacker_server = BrowserHTTPServer(("127.0.0.1", args.attacker_port), Handler)
            servers.append(attacker_server)
    except OSError as error:
        print("START_ERROR " + json.dumps({"type": type(error).__name__, "message": str(error)}), flush=True)
        return 2

    if args.mode == "https":
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=cert_path, keyfile=key_path)
        server.socket = context.wrap_socket(server.socket, server_side=True)
    for current_server in servers:
        current_server.services = services  # type: ignore[attr-defined]
        current_server.static_only = current_server is not server  # type: ignore[attr-defined]
        current_server.protocol = protocol  # type: ignore[attr-defined]
        current_server.service_port = args.port  # type: ignore[attr-defined]
        current_server.attacker_port = args.attacker_port  # type: ignore[attr-defined]
    threads = [Thread(target=current_server.serve_forever, daemon=True) for current_server in servers]
    for thread in threads:
        thread.start()
    Thread(target=command_loop, args=(servers, services), daemon=True).start()
    print(
        "READY "
        + json.dumps(
            {
                "mode": args.mode,
                "port": args.port,
                "attacker_port": args.attacker_port,
                "secure_trusted_origin": secure_trusted_origin,
                "certificate_path": str(cert_path) if cert_path else None,
                "thumbprint": thumbprint,
                "hosts": HOSTS,
            },
            sort_keys=True,
        ),
        flush=True,
    )
    for thread in threads:
        thread.join()
    for current_server in servers:
        current_server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
