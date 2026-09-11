"""The intentionally vulnerable integrated M08 mini-application."""

from __future__ import annotations

from pathlib import Path
from urllib import request

from m02_injection.vulnerable import make_database, search_users_vulnerable
from m06_authorization.vulnerable import Document, Principal, get_document_vulnerable
from m04_files_ssrf.vulnerable import fetch_url_vulnerable, read_file_vulnerable


class VulnerableMiniApplication:
    def __init__(self, document_root: Path) -> None:
        self.document_root = Path(document_root)
        self.connection = make_database()
        self.documents = {
            "invoice-alice": Document(
                "invoice-alice", "tenant-a", "alice", "alice-invoice"
            ),
            "invoice-bob": Document("invoice-bob", "tenant-a", "bob", "bob-invoice"),
        }

    def search(self, name_filter: str):
        return search_users_vulnerable(self.connection, name_filter)

    def read_document(self, requested_name: str) -> str:
        return read_file_vulnerable(self.document_root, requested_name)

    def get_invoice(self, principal: Principal, invoice_id: str) -> Document:
        return get_document_vulnerable(principal, invoice_id, self.documents)

    def preview(self, url: str, opener: request.OpenerDirector | None = None) -> bytes:
        return fetch_url_vulnerable(url, opener)

    def close(self) -> None:
        self.connection.close()
