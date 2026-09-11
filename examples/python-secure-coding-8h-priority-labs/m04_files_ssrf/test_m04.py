from __future__ import annotations

import http.server
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from urllib import request

from .secure import SecurityBoundaryError, fetch_url_secure, read_file_secure, store_upload_secure
from .vulnerable import fetch_url_vulnerable, read_file_vulnerable, store_upload_vulnerable


class _LoopbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        payload = b"loopback-internal-fixture"
        self.send_response(200)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API
        return


class _FakeResponse:
    def __init__(self, url: str, body: bytes) -> None:
        self._url = url
        self._body = body
        self.closed = False

    def geturl(self) -> str:
        return self._url

    def read(self, limit: int = -1) -> bytes:
        return self._body if limit < 0 else self._body[:limit]

    def close(self) -> None:
        self.closed = True


class _FakeOpener:
    def __init__(self, response: _FakeResponse) -> None:
        self.response = response
        self.calls = []

    def open(self, http_request, timeout: float):  # type: ignore[no-untyped-def]
        self.calls.append((http_request.full_url, timeout))
        return self.response


class M04FilesAndSSRFTests(unittest.TestCase):
    def test_normal_file_read_and_upload_work_after_repair(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            upload_dir = root / "uploads"
            upload_dir.mkdir()
            (upload_dir / "note.txt").write_text("hello", encoding="utf-8")

            self.assertEqual(read_file_secure(upload_dir, "note.txt"), "hello")
            stored = store_upload_secure(upload_dir, b"new note", "text/plain")
            self.assertEqual(stored.parent, upload_dir.resolve())
            self.assertEqual(stored.read_bytes(), b"new note")

    def test_vulnerable_path_traversal_reads_outside_the_base(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = root / "uploads"
            base.mkdir()
            secret = root / "private.txt"
            secret.write_text("synthetic-secret", encoding="utf-8")

            self.assertEqual(
                read_file_vulnerable(base, "../private.txt"),
                "synthetic-secret",
            )
            with self.assertRaises(SecurityBoundaryError):
                read_file_secure(base, "../private.txt")

    def test_vulnerable_upload_uses_client_path_but_secure_generates_one(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = root / "uploads"
            base.mkdir()

            escaped = store_upload_vulnerable(base, "../escaped.txt", b"outside")
            self.assertEqual(escaped.resolve(), (root / "escaped.txt").resolve())
            self.assertEqual((root / "escaped.txt").read_bytes(), b"outside")

            with self.assertRaises(SecurityBoundaryError):
                store_upload_secure(base, b"not-a-png", "image/png")

    def test_vulnerable_ssrf_reaches_loopback_fixture_and_secure_blocks_it(self) -> None:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _LoopbackHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        # Cleanup runs last-added first: stop the loop, wait for it, then close.
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 2)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_port}/internal"
        local_opener = request.build_opener(request.ProxyHandler({}))

        self.assertEqual(fetch_url_vulnerable(url, local_opener), b"loopback-internal-fixture")
        with self.assertRaises(SecurityBoundaryError):
            fetch_url_secure(url, {"allowed.test"})

    def test_secure_allow_path_uses_mocked_public_destination_and_bounds_response(self) -> None:
        response = _FakeResponse("https://allowed.test/resource", b"fixture-response")
        opener = _FakeOpener(response)

        def resolver(hostname: str, port: int):
            self.assertEqual((hostname, port), ("allowed.test", 443))
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]

        self.assertEqual(
            fetch_url_secure(
                "https://allowed.test/resource",
                {"allowed.test"},
                resolver=resolver,
                opener=opener,
            ),
            b"fixture-response",
        )
        self.assertTrue(response.closed)
        self.assertEqual(len(opener.calls), 1)

    def test_secure_rechecks_final_destination_and_rejects_oversized_response(self) -> None:
        def resolver(hostname: str, port: int):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]

        redirected = _FakeResponse("https://other.test/resource", b"redirected")
        with self.assertRaises(SecurityBoundaryError):
            fetch_url_secure(
                "https://allowed.test/resource",
                {"allowed.test"},
                resolver=resolver,
                opener=_FakeOpener(redirected),
            )
        self.assertTrue(redirected.closed)

        oversized = _FakeResponse("https://allowed.test/resource", b"12345")
        with self.assertRaises(SecurityBoundaryError):
            fetch_url_secure(
                "https://allowed.test/resource",
                {"allowed.test"},
                resolver=resolver,
                opener=_FakeOpener(oversized),
                max_bytes=4,
            )
        self.assertTrue(oversized.closed)


if __name__ == "__main__":
    unittest.main()
