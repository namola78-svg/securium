from __future__ import annotations

import html
import hmac
import uuid
from urllib.parse import urlsplit

from .common import (
    ALLOWED_THEMES,
    FIXTURE_DEBUG_SECRET,
    TRUSTED_ORIGIN,
    ClientInputError,
    ServiceState,
    cookie_value,
    demo_state,
    header_value,
    json_object,
    make_response,
    query_value,
)


class SecureService:
    """Local reference implementation; deliberately not production-ready."""

    def __init__(self, state: ServiceState | None = None) -> None:
        self.state = state or demo_state()

    def handle(self, method: str, request_target: str, headers: dict[str, str], body: bytes):
        try:
            return self._handle(method, request_target, headers, body)
        except ClientInputError:
            return make_response(
                400,
                error="invalid_request",
                message="request validation failed",
            )
        except Exception as error:
            return self._safe_failure(request_target, error)

    def _handle(self, method: str, request_target: str, headers: dict[str, str], body: bytes):
        path = urlsplit(request_target).path
        if path == "/comment":
            if method != "GET":
                return make_response(405, error="method_not_allowed")
            comment = query_value(request_target, "text")
            if len(comment) > 200:
                raise ClientInputError("comment is too long")
            # This is HTML text-context encoding, not a universal input sanitizer.
            encoded_comment = html.escape(comment, quote=True)
            return make_response(200, html=f'<p class="comment">{encoded_comment}</p>')

        if path == "/settings/theme":
            if method != "POST":
                return make_response(405, error="method_not_allowed")

            session_id = cookie_value(headers, "session_id")
            session = self.state.sessions.get(session_id or "")
            if session is None:
                return make_response(401, error="authentication_required")

            # The state-changing browser contract requires both a known origin
            # and a token bound to this existing server-side session.
            if header_value(headers, "Origin") != TRUSTED_ORIGIN:
                return make_response(403, error="csrf_failed")
            supplied_token = header_value(headers, "X-CSRF-Token") or ""
            if not hmac.compare_digest(supplied_token, session.csrf_token):
                return make_response(403, error="csrf_failed")

            payload = json_object(body)
            theme = payload.get("theme")
            if set(payload) != {"theme"} or theme not in ALLOWED_THEMES:
                raise ClientInputError("theme is not allowed")
            session.theme = theme
            return make_response(200, changed=True, theme=session.theme)

        if path == "/debug/fail":
            if method != "GET":
                return make_response(405, error="method_not_allowed")
            raise RuntimeError(f"{FIXTURE_DEBUG_SECRET}; synthetic database failure")

        return make_response(404, error="not_found")

    def _safe_failure(self, request_target: str, error: Exception):
        request_id = uuid.uuid4().hex[:12]
        # Keep operator telemetry correlated but omit exception text, query data,
        # credentials, and tracebacks from this teaching log sink.
        self.state.logs.append(
            "ERROR "
            f"request_id={request_id} "
            f"path={urlsplit(request_target).path} "
            f"exception_type={type(error).__name__}"
        )
        return make_response(500, error="internal_error", request_id=request_id)
