"""Provided draft with a trust-boundary mistake for the M01 review exercise."""

from __future__ import annotations

from typing import Any

from .models import AvatarProfile, ViewerContext


SYNTHETIC_AVATAR = AvatarProfile(
    display_name="Ada Example",
    public_bio="Python developer",
    private_note="synthetic-private-note",
)


def render_avatar_vulnerable(
    request_data: dict[str, Any],
    viewer: ViewerContext,
) -> dict[str, str]:
    """Vulnerable: a request flag controls private-field projection."""

    response = {
        "display_name": str(request_data.get("display_name", SYNTHETIC_AVATAR.display_name)),
        "bio": str(request_data.get("bio", SYNTHETIC_AVATAR.public_bio)),
    }
    if request_data.get("include_private", False):
        response["private_note"] = SYNTHETIC_AVATAR.private_note
    return response
