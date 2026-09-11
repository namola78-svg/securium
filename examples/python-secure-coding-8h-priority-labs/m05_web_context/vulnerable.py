from __future__ import annotations

import traceback
from urllib.parse import urlsplit

from .common import (
    ALLOWED_THEMES,
    FIXTURE_DEBUG_SECRET,
    ClientInputError,
    ServiceState,
    cookie_value,
    demo_state,
    json_object,
    make_response,
    query_value,
)


class VulnerableService:
    """Teaching draft with raw HTML, missing CSRF checks, and leaked failures."""

    def __init__(self, state: ServiceState | None = None) -> None:
        self.state = state or demo_state()

    def handle(self, method: str, request_target: str, headers: dict[str, str], body: bytes):
        try:
            return self._handle(method, request_target, headers, body)
        except ClientInputError:
            return make_response(400, error="invalid_request")
        except Exception as error:  # Deliberately unsafe error behavior for review.
            trace = traceback.format_exc()
            self.state.logs.append(
                f"ERROR path={request_target} exception={error!r}\n{trace}"
            )
            return make_response(500, error=str(error), traceback=trace)

    def _handle(self, method: str, request_target: str, headers: dict[str, str], body: bytes):
        path = urlsplit(request_target).path
        if path == "/comment":
            if method != "GET":
                return make_response(405, error="method_not_allowed")
            comment = query_value(request_target, "text")
            # Vulnerability: request text reaches an HTML sink without encoding.
            return make_response(200, html=f'<p class="comment">{comment}</p>')

        if path == "/settings/theme":
            if method != "POST":
                return make_response(405, error="method_not_allowed")
            session_id = cookie_value(headers, "session_id")
            session = self.state.sessions.get(session_id or "")
            if session is None:
                return make_response(401, error="authentication_required")
            payload = json_object(body)
            theme = payload.get("theme")
            if set(payload) != {"theme"} or theme not in ALLOWED_THEMES:
                raise ClientInputError("theme is not allowed")
            # Vulnerability: ambient session cookie is enough; no CSRF contract.
            session.theme = theme
            return make_response(200, changed=True, theme=session.theme)

        if path == "/debug/fail":
            if method != "GET":
                return make_response(405, error="method_not_allowed")
            raise RuntimeError(f"{FIXTURE_DEBUG_SECRET}; synthetic database failure")

        return make_response(404, error="not_found")
