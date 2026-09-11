"""Reference repair for the M01 trust-boundary teaching fixture."""

from __future__ import annotations

from typing import Any

from .models import AvatarProfile, ViewerContext


class BoundaryPolicyError(ValueError):
    """Request data or server-owned context violates the endpoint policy."""


SYNTHETIC_AVATAR = AvatarProfile(
    display_name="Ada Example",
    public_bio="Python developer",
    private_note="synthetic-private-note",
)


def _validate_request(request_data: dict[str, Any]) -> tuple[str, str]:
    if not isinstance(request_data, dict) or set(request_data) != {"display_name", "bio"}:
        raise BoundaryPolicyError("request fields are not allowlisted")

    display_name = request_data["display_name"]
    bio = request_data["bio"]
    if (
        type(display_name) is not str
        or type(bio) is not str
        or not 1 <= len(display_name) <= 64
        or len(bio) > 280
        or not display_name.isprintable()
        or not bio.isprintable()
    ):
        raise BoundaryPolicyError("avatar text violates the input policy")
    return display_name, bio


def render_avatar_secure(
    request_data: dict[str, Any],
    viewer: ViewerContext,
) -> dict[str, str]:
    """Use request data for public text and server context for private policy."""

    display_name, bio = _validate_request(request_data)
    response = {"display_name": display_name, "bio": bio}
    if viewer.can_view_private:
        response["private_note"] = SYNTHETIC_AVATAR.private_note
    return response
