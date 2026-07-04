from datetime import datetime

from pydantic import BaseModel


class ConvertToProfessionalRequest(BaseModel):
    tax_registration_id: str
    activity_registration_number: str


class ConvertToOrganizationRequest(BaseModel):
    organization_name: str


# --- Post-Phase-6 decision (docs/roles-permissions/phase0-decisions.md Addendum 5): the reverse
# `professional` -> `individual` direction + the mandatory live preview. Note
# there is deliberately no request body/`user_id` field on the conversion
# itself — self-service only, always acts on the authenticated caller. ---

class EntityConversionStateSnapshot(BaseModel):
    """One side (current or projected) of the live conversion comparison —
    real values read off (or computed for) the acting user, never a static
    template. Field list: `app.services.entity_conversion.PREVIEW_FIELDS`
    plus entity_kind/entity_id/rank(_label)."""

    entity_kind: str | None = None
    entity_id: int | None = None
    rank: int | None = None
    rank_label: str | None = None
    is_verified: bool = False
    verified_at: datetime | None = None
    can_self_publish: bool = False
    self_publish_agreed_at: datetime | None = None
    can_edit_copy: bool = False
    email_verified: bool = False
    registration_number: str | None = None
    activity_registration_number: str | None = None
    account_status: str = "active"

    model_config = {"from_attributes": True}


class EntityConversionPreviewResponse(BaseModel):
    to: str
    current: EntityConversionStateSnapshot
    projected: EntityConversionStateSnapshot
    # Convenience flag the frontend can key its "your rank will be capped"
    # messaging off directly, without re-deriving it from current/projected.
    rank_capped: bool


class EntityResponse(BaseModel):
    id: int
    entity_type: str
    name: str
    verification_status: str
    verified_at: datetime | None = None
    verified_by: int | None = None
    primary_contact_user_id: int | None = None
    tax_registration_id: str | None = None
    tax_registration_scheme: str | None = None
    dissolved_at: datetime | None = None
    dissolution_grace_expires_at: datetime | None = None
    dissolution_requested_at: datetime | None = None
    banned_at: datetime | None = None
    ban_cascade_grace_expires_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Phase 5: entity registration/verification (docs/roles-permissions/assessment.md §5.2, §10a) ---

class EntityRegisterRequest(BaseModel):
    entity_type: str  # "organization" | "partners" | "suppliers"
    name: str
    tax_registration_id: str | None = None
    tax_registration_scheme: str | None = None


class EntityVerificationDecisionRequest(BaseModel):
    reason: str | None = None


class EntityDocumentResponse(BaseModel):
    id: int
    entity_id: int
    uploaded_by: int
    filename: str
    content_type: str
    size_bytes: int
    review_note: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Phase 5: entity-scoped "manage my team" (docs/roles-permissions/ROLES_PERMISSIONS.md §3) ---

class EntityMemberResponse(BaseModel):
    id: int
    name: str
    email: str
    entity_kind: str | None = None
    rank: int | None = None

    model_config = {"from_attributes": True}


class TeamRosterAddRequest(BaseModel):
    user_id: int


# --- Phase 5: delegation-grant CRUD (docs/roles-permissions/ROLES_PERMISSIONS.md §10) ---

class DelegationGrantRequest(BaseModel):
    grantee_id: int
    action: str
    entity_id: int | None = None


class DelegationGrantResponse(BaseModel):
    id: int
    grantor_id: int
    grantee_id: int
    entity_id: int | None = None
    action: str
    granted_at: datetime
    revoked_at: datetime | None = None
    revoked_reason: str | None = None

    model_config = {"from_attributes": True}


class DelegationRevokeRequest(BaseModel):
    reason: str | None = None


class DissolutionActionRequest(BaseModel):
    reason: str | None = None


class EntityBanRequest(BaseModel):
    reason: str | None = None


class RoleChangeSubmitRequest(BaseModel):
    target_user_id: int
    to_rank: int
    reason: str | None = None


class RoleChangeDecisionRequest(BaseModel):
    reason: str | None = None


class RoleChangeRequestResponse(BaseModel):
    id: int
    entity_kind: str
    entity_id: int | None = None
    target_user_id: int
    requested_by: int
    requested_by_rank: int
    from_rank: int
    to_rank: int
    direction: str
    status: str
    reason: str | None = None
    self_approved: bool = False
    decided_by: int | None = None
    decided_at: datetime | None = None
    decision_reason: str | None = None

    model_config = {"from_attributes": True}
