"""The reference integrated M08 mini-application."""

from __future__ import annotations

from pathlib import Path
from urllib import request

from m02_injection.secure import search_users_secure
from m04_files_ssrf.secure import fetch_url_secure, read_file_secure
from m06_authorization.secure import get_document_secure
from m06_authorization.vulnerable import Document, Principal


class SecureMiniApplication:
    def __init__(
        self,
        document_root: Path,
        allowed_preview_hosts: set[str],
        resolver=None,
        opener: request.OpenerDirector | None = None,
    ) -> None:
        from m02_injection.vulnerable import make_database

        self.document_root = Path(document_root)
        self.connection = make_database()
        self.documents = {
            "invoice-alice": Document(
                "invoice-alice", "tenant-a", "alice", "alice-invoice"
            ),
            "invoice-bob": Document("invoice-bob", "tenant-a", "bob", "bob-invoice"),
        }
        self.allowed_preview_hosts = allowed_preview_hosts
        self.resolver = resolver
        self.opener = opener

    def search(self, name_filter: str):
        return search_users_secure(self.connection, name_filter)

    def read_document(self, requested_name: str) -> str:
        return read_file_secure(self.document_root, requested_name)

    def get_invoice(self, principal: Principal, invoice_id: str) -> Document:
        return get_document_secure(principal, invoice_id, self.documents)

    def preview(self, url: str) -> bytes:
        kwargs = {
            "allowed_hosts": self.allowed_preview_hosts,
            "opener": self.opener,
        }
        if self.resolver is not None:
            kwargs["resolver"] = self.resolver
        return fetch_url_secure(url, **kwargs)

    def close(self) -> None:
        self.connection.close()
