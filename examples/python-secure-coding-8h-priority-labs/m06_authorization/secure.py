"""Reference repairs for the M06 teaching fixtures."""

from __future__ import annotations

import secrets

from .session import Session, SessionStore
from .vulnerable import Document, Principal


class AuthorizationError(PermissionError):
    pass


def _allows(principal: Principal | None, document: Document, action: str) -> bool:
    if principal is None or not principal.authenticated:
        return False
    if principal.tenant_id != document.tenant_id:
        return False
    if action == "read":
        return principal.user_id == document.owner_id or principal.role in {"member", "admin"}
    if action in {"update", "delete"}:
        return principal.user_id == document.owner_id or principal.role == "admin"
    return False


def get_document_secure(
    principal: Principal | None,
    document_id: str,
    documents: dict[str, Document],
) -> Document:
    document = documents.get(document_id)
    if document is None or not _allows(principal, document, "read"):
        raise AuthorizationError("object access denied")
    return document


def update_document_secure(
    principal: Principal | None,
    document_id: str,
    body: str,
    documents: dict[str, Document],
) -> Document:
    document = documents.get(document_id)
    if document is None or not _allows(principal, document, "update"):
        raise AuthorizationError("object access denied")
    document.body = body
    return document


def login_secure(store: SessionStore, pre_authentication_id: str, user_id: str) -> str:
    """Rotate the identifier and invalidate the pre-authentication session."""

    old_session = store.get(pre_authentication_id)
    if old_session is None or old_session.revoked:
        raise PermissionError("invalid session")
    old_session.revoked = True
    new_id = secrets.token_urlsafe(18)
    store.sessions[new_id] = Session(
        session_id=new_id,
        user_id=user_id,
        authenticated=True,
    )
    return new_id
