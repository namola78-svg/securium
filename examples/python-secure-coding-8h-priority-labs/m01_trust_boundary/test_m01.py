from __future__ import annotations

import unittest

from .models import ViewerContext
from .secure import BoundaryPolicyError, render_avatar_secure
from .vulnerable import render_avatar_vulnerable


PUBLIC_VIEWER = ViewerContext(viewer_id="viewer-public", can_view_private=False)
PRIVATE_VIEWER = ViewerContext(viewer_id="viewer-staff", can_view_private=True)
NORMAL_REQUEST = {"display_name": "Grace", "bio": "Python learner"}


class M01TrustBoundaryTests(unittest.TestCase):
    def test_normal_public_avatar_behavior_is_preserved(self) -> None:
        self.assertEqual(
            render_avatar_secure(NORMAL_REQUEST, PUBLIC_VIEWER),
            {"display_name": "Grace", "bio": "Python learner"},
        )

    def test_client_private_flag_exposes_draft_data_but_secure_rejects_it(self) -> None:
        attack_request = {**NORMAL_REQUEST, "include_private": True}
        vulnerable_response = render_avatar_vulnerable(attack_request, PUBLIC_VIEWER)
        self.assertEqual(vulnerable_response["private_note"], "synthetic-private-note")

        with self.assertRaises(BoundaryPolicyError):
            render_avatar_secure(attack_request, PUBLIC_VIEWER)

    def test_server_owned_context_preserves_intended_private_view(self) -> None:
        public_response = render_avatar_secure(NORMAL_REQUEST, PUBLIC_VIEWER)
        private_response = render_avatar_secure(NORMAL_REQUEST, PRIVATE_VIEWER)

        self.assertNotIn("private_note", public_response)
        self.assertEqual(private_response["private_note"], "synthetic-private-note")
        self.assertEqual(private_response["display_name"], NORMAL_REQUEST["display_name"])

    def test_secure_validation_rejects_unbounded_or_wrong_type_input(self) -> None:
        with self.assertRaises(BoundaryPolicyError):
            render_avatar_secure({"display_name": "", "bio": "ok"}, PUBLIC_VIEWER)
        with self.assertRaises(BoundaryPolicyError):
            render_avatar_secure(
                {"display_name": "Grace", "bio": "x" * 281}, PUBLIC_VIEWER
            )
        with self.assertRaises(BoundaryPolicyError):
            render_avatar_secure({"display_name": 7, "bio": "ok"}, PUBLIC_VIEWER)

    def test_regression_public_fields_are_not_replaced_by_security_rejection(self) -> None:
        response = render_avatar_secure(
            {"display_name": "Updated", "bio": "Updated bio"}, PUBLIC_VIEWER
        )
        self.assertEqual(response["display_name"], "Updated")
        self.assertEqual(response["bio"], "Updated bio")
        self.assertEqual(set(response), {"display_name", "bio"})


if __name__ == "__main__":
    unittest.main()
