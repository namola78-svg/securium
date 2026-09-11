from __future__ import annotations

import unittest

from .secure import (
    AuthorizationError,
    get_document_secure,
    login_secure,
    update_document_secure,
)
from .session import SessionStore
from .vulnerable import (
    Document,
    Principal,
    get_document_vulnerable,
    login_vulnerable,
    update_document_vulnerable,
)


def fixture_documents() -> dict[str, Document]:
    return {
        "doc-alice": Document("doc-alice", "tenant-a", "alice", "alice-private"),
        "doc-bob": Document("doc-bob", "tenant-a", "bob", "bob-private"),
        "doc-other-tenant": Document("doc-other-tenant", "tenant-b", "carol", "other"),
    }


class M06AuthorizationTests(unittest.TestCase):
    def test_owner_normal_read_and_update_work_after_repair(self) -> None:
        documents = fixture_documents()
        owner = Principal("alice", "tenant-a", "user")

        self.assertEqual(get_document_secure(owner, "doc-alice", documents).body, "alice-private")
        updated = update_document_secure(owner, "doc-alice", "updated", documents)
        self.assertEqual(updated.body, "updated")

    def test_vulnerable_login_only_check_allows_idor_but_secure_denies(self) -> None:
        documents = fixture_documents()
        bob = Principal("bob", "tenant-a", "user")

        self.assertEqual(get_document_vulnerable(bob, "doc-alice", documents).owner_id, "alice")
        with self.assertRaises(AuthorizationError):
            get_document_secure(bob, "doc-alice", documents)
        with self.assertRaises(AuthorizationError):
            update_document_secure(bob, "doc-alice", "tampered", documents)

    def test_default_deny_and_tenant_boundary_apply_to_unknown_actions(self) -> None:
        documents = fixture_documents()
        unrelated = Principal("dave", "tenant-a", "user")
        other_tenant_admin = Principal("erin", "tenant-b", "admin")

        with self.assertRaises(AuthorizationError):
            get_document_secure(unrelated, "doc-alice", documents)
        with self.assertRaises(AuthorizationError):
            get_document_secure(other_tenant_admin, "doc-alice", documents)
        with self.assertRaises(PermissionError):
            get_document_secure(None, "doc-alice", documents)

    def test_same_tenant_admin_can_have_explicit_cross_owner_permission(self) -> None:
        documents = fixture_documents()
        admin = Principal("admin", "tenant-a", "admin")
        self.assertEqual(get_document_secure(admin, "doc-alice", documents).owner_id, "alice")

    def test_session_fixation_is_reproduced_and_rotation_is_verified(self) -> None:
        vulnerable_store = SessionStore()
        known_id = vulnerable_store.create_anonymous()
        self.assertEqual(login_vulnerable(vulnerable_store, known_id, "alice"), known_id)
        self.assertTrue(vulnerable_store.get(known_id).authenticated)

        secure_store = SessionStore()
        pre_auth_id = secure_store.create_anonymous()
        new_id = login_secure(secure_store, pre_auth_id, "alice")
        self.assertNotEqual(new_id, pre_auth_id)
        self.assertTrue(secure_store.get(new_id).authenticated)
        self.assertTrue(secure_store.get(pre_auth_id).revoked)


if __name__ == "__main__":
    unittest.main()
