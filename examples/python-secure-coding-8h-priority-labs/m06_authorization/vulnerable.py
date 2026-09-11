"""Intentionally vulnerable M06 authorization/session examples."""

from __future__ import annotations

from dataclasses import dataclass

from .session import SessionStore


@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    role: str
    authenticated: bool = True


@dataclass
class Document:
    document_id: str
    tenant_id: str
    owner_id: str
    body: str


def get_document_vulnerable(
    principal: Principal | None,
    document_id: str,
    documents: dict[str, Document],
) -> Document:
    """Vulnerable: login is checked, but object authorization is absent."""

    if principal is None or not principal.authenticated:
        raise PermissionError("authentication required")
    return documents[document_id]


def update_document_vulnerable(
    principal: Principal | None,
    document_id: str,
    body: str,
    documents: dict[str, Document],
) -> Document:
    document = get_document_vulnerable(principal, document_id, documents)
    document.body = body
    return document


def login_vulnerable(store: SessionStore, pre_authentication_id: str, user_id: str) -> str:
    """Vulnerable: authentication keeps the attacker-known session ID."""

    session = store.get(pre_authentication_id)
    if session is None or session.revoked:
        raise PermissionError("invalid session")
    session.user_id = user_id
    session.authenticated = True
    return pre_authentication_id
