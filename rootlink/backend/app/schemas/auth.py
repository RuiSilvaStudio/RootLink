from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    account_type: str = "individual"
    entity_type: str | None = None
    registration_number: str | None = None
    services: list[str] | None = None
    service_area: str | None = None
    modality: str | None = None
    certifications: list[str] | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    bio: str | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    skills: list[str] | None = None
    interests: list[str] | None = None
    avatar_url: str | None = None
    role: UserRole = UserRole.user
    visible_in_network: bool = True
    locale: str | None = None
    account_type: str = "individual"
    entity_type: str | None = None
    registration_number: str | None = None
    services: list[str] | None = None
    service_area: str | None = None
    certifications: list[str] | None = None
    modality: str | None = None
    is_verified: bool = False
    verified_at: datetime | None = None
    website_url: str | None = None
    feed_url: str | None = None
    feed_verified: bool = False
    feed_priority: int = 3
    boost_active: bool = False
    boost_expires_at: datetime | None = None
    # Content platform (§3, §4.4, §12) — let the frontend gate UI accordingly.
    # `account_status` (§4.4) is now the roles/permissions redesign's shared
    # ladder field too (docs/roles-permissions/ROLES_PERMISSIONS.md §4, incl.
    # the `restricted` value); `can_self_publish`/`can_edit_copy` remain
    # CONTENT_PLATFORM.md §3/§12's original, unchanged flags.
    can_self_publish: bool = False
    can_edit_copy: bool = False
    account_status: str = "active"
    # Roles/permissions redesign — Phase 5 addition. Previously NOT exposed
    # here at all (flagged as a real, documented gap in `lib/use-permission.ts`'s
    # own module docstring, point 1: the frontend had to re-derive an
    # equivalent entity_kind/rank from role/account_type instead of reading
    # the real stored values). Exposing them closes that gap — Phase 5's
    # entity-scoped UI surfaces (team panel, delegation grants) need the
    # real `entity_id` to scope requests correctly, which no derivation from
    # role/account_type could ever produce (that FK isn't derivable from
    # anything else on the user row). Nullable/None-default: safe for any
    # row not yet touched by the Phase 1 migration or `entity_resolution`'s
    # live fallback (those still resolve correctly server-side via `can()`;
    # this field is what the client sees, not what's authoritative).
    entity_kind: str | None = None
    rank: int | None = None
    entity_id: int | None = None

    model_config = {"from_attributes": True}


class EmailVerificationRequestResponse(BaseModel):
    """Phase 2 (docs/roles-permissions/phase0-decisions.md (g)).

    No email-sending infrastructure exists in this codebase yet — the raw
    token is returned directly in the response for local dev/testing. This
    is explicitly a dev-only stand-in; wire up real email delivery (and stop
    returning `token` here) before this reaches real users.
    """

    token: str
    expires_at: datetime


class EmailVerificationConfirmRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetRequestResponse(BaseModel):
    """Constant-shape response regardless of whether the email exists, to
    avoid leaking which addresses are registered. `token` is only present
    (dev-only, see EmailVerificationRequestResponse's docstring) when the
    account exists — absent otherwise, but the HTTP status/message are the
    same either way.
    """

    message: str
    token: str | None = None
    expires_at: datetime | None = None


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str


class SessionsRevokedResponse(BaseModel):
    revoked_count: int


class UserUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    skills: list[str] | None = None
    interests: list[str] | None = None
    avatar_url: str | None = None
    visible_in_network: bool | None = None
    locale: str | None = None
    website_url: str | None = None
    services: list[str] | None = None
    service_area: str | None = None
    certifications: list[str] | None = None
    modality: str | None = None
    feed_url: str | None = None
