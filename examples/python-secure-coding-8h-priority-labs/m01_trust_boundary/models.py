"""Neutral server-owned models shared by the M01 draft and reference code."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AvatarProfile:
    display_name: str
    public_bio: str
    private_note: str


@dataclass(frozen=True)
class ViewerContext:
    """Created by a trusted server-side boundary, never parsed from the request."""

    viewer_id: str
    can_view_private: bool
