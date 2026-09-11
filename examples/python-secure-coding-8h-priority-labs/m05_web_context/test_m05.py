from __future__ import annotations

import json
from urllib import error, request
from urllib.parse import urlencode
import unittest

from .common import FIXTURE_DEBUG_SECRET, LocalServiceServer, TRUSTED_ORIGIN
from .secure import SecureService
from .vulnerable import VulnerableService


def call_json(
    server: LocalServiceServer,
    path: str,
    *,
    method: str = "GET",
    cookie: str | None = None,
    csrf_token: str | None = None,
    origin: str | None = None,
    payload: dict[str, object] | None = None,
) -> tuple[int, dict[str, object]]:
    headers = {"Accept": "application/json"}
    if cookie is not None:
        headers["Cookie"] = cookie
    if csrf_token is not None:
        headers["X-CSRF-Token"] = csrf_token
    if origin is not None:
        headers["Origin"] = origin
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    http_request = request.Request(
        server.url(path), data=data, headers=headers, method=method
    )
    opener = request.build_opener(request.ProxyHandler({}))
    try:
        with opener.open(http_request, timeout=2) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except error.HTTPError as response:
        with response:
            return response.code, json.loads(response.read().decode("utf-8"))


class M05WebContextTests(unittest.TestCase):
    def test_trusted_origin_override_is_explicit_and_exact(self) -> None:
        self.assertEqual(SecureService().trusted_origin, TRUSTED_ORIGIN)

        service = SecureService(trusted_origin="http://app.local")
        with LocalServiceServer(service) as server:
            status, response = call_json(
                server,
                "/settings/theme",
                method="POST",
                cookie="session_id=alice",
                csrf_token="alice-csrf-token",
                origin="http://app.local",
                payload={"theme": "dark"},
            )
            self.assertEqual(status, 200)
            self.assertEqual(response, {"changed": True, "theme": "dark"})
            self.assertEqual(service.state.sessions["alice"].theme, "dark")

            service.state.sessions["alice"].theme = "light"
            status, response = call_json(
                server,
                "/settings/theme",
                method="POST",
                cookie="session_id=alice",
                csrf_token="alice-csrf-token",
                origin="http://app.local:8080",
                payload={"theme": "dark"},
            )
            self.assertEqual(status, 403)
            self.assertEqual(response, {"error": "csrf_failed"})
            self.assertEqual(service.state.sessions["alice"].theme, "light")

    def test_normal_comment_and_theme_change_work_after_repair(self) -> None:
        service = SecureService()
        with LocalServiceServer(service) as server:
            status, comment = call_json(
                server,
                "/comment?" + urlencode({"text": "hello team"}),
                cookie="session_id=alice",
            )
            self.assertEqual(status, 200)
            self.assertEqual(comment["html"], '<p class="comment">hello team</p>')

            status, changed = call_json(
                server,
                "/settings/theme",
                method="POST",
                cookie="session_id=alice",
                csrf_token="alice-csrf-token",
                origin=TRUSTED_ORIGIN,
                payload={"theme": "dark"},
            )
            self.assertEqual(status, 200)
            self.assertEqual(changed, {"changed": True, "theme": "dark"})
            self.assertEqual(service.state.sessions["alice"].theme, "dark")

    def test_html_context_is_raw_in_draft_and_escaped_in_reference(self) -> None:
        attack = '<script>alert("xss")</script>'
        path = "/comment?" + urlencode({"text": attack})

        vulnerable = VulnerableService()
        with LocalServiceServer(vulnerable) as server:
            status, response = call_json(server, path)
            self.assertEqual(status, 200)
            self.assertIn(attack, response["html"])

        secure = SecureService()
        with LocalServiceServer(secure) as server:
            status, response = call_json(server, path)
            self.assertEqual(status, 200)
            self.assertNotIn(attack, response["html"])
            self.assertIn("&lt;script&gt;", response["html"])

    def test_cross_site_request_changes_draft_but_secure_request_is_denied(self) -> None:
        attacker_origin = "https://attacker.test"
        # The cookie models an ambient browser credential. This remains an HTTP
        # client test, not a claim about a real browser's SameSite behavior.
        vulnerable = VulnerableService()
        with LocalServiceServer(vulnerable) as server:
            status, response = call_json(
                server,
                "/settings/theme",
                method="POST",
                cookie="session_id=alice",
                origin=attacker_origin,
                payload={"theme": "dark"},
            )
            self.assertEqual(status, 200)
            self.assertEqual(response["changed"], True)
            self.assertEqual(vulnerable.state.sessions["alice"].theme, "dark")

        secure = SecureService()
        with LocalServiceServer(secure) as server:
            status, response = call_json(
                server,
                "/settings/theme",
                method="POST",
                cookie="session_id=alice",
                origin=attacker_origin,
                payload={"theme": "dark"},
            )
            self.assertEqual(status, 403)
            self.assertEqual(response, {"error": "csrf_failed"})
            self.assertEqual(secure.state.sessions["alice"].theme, "light")

    def test_missing_wrong_and_other_session_tokens_do_not_change_state(self) -> None:
        service = SecureService()
        with LocalServiceServer(service) as server:
            attempts = [
                {},
                {"csrf_token": "not-alice-token"},
                {"csrf_token": "bob-csrf-token"},
            ]
            for extra in attempts:
                status, response = call_json(
                    server,
                    "/settings/theme",
                    method="POST",
                    cookie="session_id=alice",
                    origin=TRUSTED_ORIGIN,
                    payload={"theme": "dark"},
                    **extra,
                )
                self.assertEqual(status, 403)
                self.assertEqual(response, {"error": "csrf_failed"})
                self.assertEqual(service.state.sessions["alice"].theme, "light")

    def test_method_auth_and_input_failures_are_distinct_and_state_stays_unchanged(self) -> None:
        service = SecureService()
        with LocalServiceServer(service) as server:
            method_status, _ = call_json(
                server,
                "/settings/theme",
                cookie="session_id=alice",
            )
            auth_status, _ = call_json(
                server,
                "/settings/theme",
                method="POST",
                origin=TRUSTED_ORIGIN,
                payload={"theme": "dark"},
            )
            input_status, _ = call_json(
                server,
                "/settings/theme",
                method="POST",
                cookie="session_id=alice",
                csrf_token="alice-csrf-token",
                origin=TRUSTED_ORIGIN,
                payload={"theme": "blue"},
            )
            self.assertEqual(method_status, 405)
            self.assertEqual(auth_status, 401)
            self.assertEqual(input_status, 400)
            self.assertEqual(
                {method_status, auth_status, input_status}, {400, 401, 405}
            )
            self.assertEqual(service.state.sessions["alice"].theme, "light")

    def test_secure_failure_is_correlated_and_redacted_while_draft_leaks(self) -> None:
        path = "/debug/fail?token=client-supplied-secret"
        vulnerable = VulnerableService()
        with LocalServiceServer(vulnerable) as server:
            status, response = call_json(server, path)
            self.assertEqual(status, 500)
            self.assertIn(FIXTURE_DEBUG_SECRET, json.dumps(response))
            self.assertIn("Traceback", response["traceback"])
            self.assertIn(FIXTURE_DEBUG_SECRET, vulnerable.state.logs[0])

        secure = SecureService()
        with LocalServiceServer(secure) as server:
            status, response = call_json(server, path)
            self.assertEqual(status, 500)
            self.assertEqual(response["error"], "internal_error")
            self.assertRegex(response["request_id"], r"^[0-9a-f]{12}$")
            evidence = json.dumps(response) + "\n" + "\n".join(secure.state.logs)
            self.assertNotIn(FIXTURE_DEBUG_SECRET, evidence)
            self.assertNotIn("client-supplied-secret", evidence)
            self.assertNotIn("Traceback", evidence)
            self.assertIn(response["request_id"], secure.state.logs[0])


if __name__ == "__main__":
    unittest.main()
