from datetime import datetime

from pydantic import BaseModel


class SuspendRequest(BaseModel):
    until: datetime
    reason: str | None = None


class BanRequest(BaseModel):
    reason: str | None = None


class SelfPublishGrant(BaseModel):
    grant: bool = True


class RestrictRequest(BaseModel):
    """Phase 4 restriction rung (docs/roles-permissions/ROLES_PERMISSIONS.md §4) — no `until`, unlike
    suspension: restriction is indefinite until explicitly lifted."""

    reason: str | None = None
