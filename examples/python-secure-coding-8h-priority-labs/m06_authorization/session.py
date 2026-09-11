"""In-memory session fixtures for the M06 session-fixation exercise."""

from __future__ import annotations

from dataclasses import dataclass
import secrets


@dataclass
class Session:
    session_id: str
    user_id: str | None = None
    authenticated: bool = False
    revoked: bool = False


class SessionStore:
    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}

    def create_anonymous(self) -> str:
        session_id = secrets.token_urlsafe(18)
        self.sessions[session_id] = Session(session_id=session_id)
        return session_id

    def get(self, session_id: str) -> Session | None:
        return self.sessions.get(session_id)
