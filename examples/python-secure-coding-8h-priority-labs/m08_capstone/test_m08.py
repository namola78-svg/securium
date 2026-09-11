from __future__ import annotations

import http.server
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from urllib import request

from m04_files_ssrf.secure import SecurityBoundaryError
from m06_authorization.secure import AuthorizationError
from m06_authorization.vulnerable import Principal

from .secure_app import SecureMiniApplication
from .vulnerable_app import VulnerableMiniApplication


class _LoopbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        payload = b"capstone-internal"
        self.send_response(200)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API
        return


class _FakeResponse:
    def __init__(self, url: str, body: bytes) -> None:
        self.url = url
        self.body = body
        self.closed = False

    def geturl(self) -> str:
        return self.url

    def read(self, limit: int = -1) -> bytes:
        return self.body if limit < 0 else self.body[:limit]

    def close(self) -> None:
        self.closed = True


class _FakeOpener:
    def __init__(self, response: _FakeResponse) -> None:
        self.response = response

    def open(self, http_request, timeout: float):  # type: ignore[no-untyped-def]
        return self.response


class M08CapstoneTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.document_root = root / "documents"
        self.document_root.mkdir()
        (self.document_root / "public.txt").write_text("public-fixture", encoding="utf-8")
        (root / "private.txt").write_text("capstone-private", encoding="utf-8")
        self.vulnerable = VulnerableMiniApplication(self.document_root)
        self.secure = SecureMiniApplication(self.document_root, {"allowed.test"})

    def tearDown(self) -> None:
        self.vulnerable.close()
        self.secure.close()
        self.temp_dir.cleanup()

    def test_normal_feature_paths_work_in_secure_application(self) -> None:
        alice = Principal("alice", "tenant-a", "user")
        self.assertEqual([row[1] for row in self.secure.search("ali")], ["alice"])
        self.assertEqual(self.secure.read_document("public.txt"), "public-fixture")
        self.assertEqual(self.secure.get_invoice(alice, "invoice-alice").body, "alice-invoice")

    def test_sql_attack_is_reproduced_then_blocked(self) -> None:
        payload = "%' OR 1=1 --"
        self.assertEqual(len(self.vulnerable.search(payload)), 3)
        self.assertEqual(self.secure.search(payload), [])

    def test_path_attack_is_reproduced_then_blocked(self) -> None:
        self.assertEqual(self.vulnerable.read_document("../private.txt"), "capstone-private")
        with self.assertRaises(SecurityBoundaryError):
            self.secure.read_document("../private.txt")

    def test_idor_attack_is_reproduced_then_blocked(self) -> None:
        bob = Principal("bob", "tenant-a", "user")
        self.assertEqual(self.vulnerable.get_invoice(bob, "invoice-alice").owner_id, "alice")
        with self.assertRaises(AuthorizationError):
            self.secure.get_invoice(bob, "invoice-alice")

    def test_ssrf_attack_is_reproduced_on_loopback_then_blocked(self) -> None:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _LoopbackHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        # Cleanup runs last-added first: stop the loop, wait for it, then close.
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 2)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_port}/metadata"
        local_opener = request.build_opener(request.ProxyHandler({}))

        self.assertEqual(self.vulnerable.preview(url, local_opener), b"capstone-internal")
        with self.assertRaises(SecurityBoundaryError):
            self.secure.preview(url)

    def test_secure_preview_normal_case_is_policy_tested_without_external_network(self) -> None:
        response = _FakeResponse("https://allowed.test/preview", b"approved-fixture")
        opener = _FakeOpener(response)

        def resolver(hostname: str, port: int):
            self.assertEqual((hostname, port), ("allowed.test", 443))
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]

        app = SecureMiniApplication(
            self.document_root,
            {"allowed.test"},
            resolver=resolver,
            opener=opener,
        )
        self.addCleanup(app.close)
        self.assertEqual(app.preview("https://allowed.test/preview"), b"approved-fixture")
        self.assertTrue(response.closed)


if __name__ == "__main__":
    unittest.main()
