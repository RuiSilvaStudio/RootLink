import json
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

# ── Shared validators ──────────────────────────────────────────────────────

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PHONE_RE = re.compile(r"^\+?[0-9 ().\-]{6,20}$")


def _valid_url(v: str | None) -> str | None:
    """Accept http(s) URLs and site-relative paths. Reject javascript: etc."""
    if v is None or v == "":
        return None
    v = v.strip()
    if v.startswith("/") and not v.startswith("//"):
        return v  # site-relative (uploads)
    if re.match(r"^https?://[^\s]+$", v, re.IGNORECASE):
        return v
    raise ValueError("Must be an http(s) URL or a site-relative path")


def _valid_phone(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    v = v.strip()
    if not PHONE_RE.match(v):
        raise ValueError("Invalid phone number format")
    return v


def _valid_json_string_list(v: str | None) -> str | None:
    """Validate a Text column that must hold a JSON array of strings."""
    if v is None or v == "":
        return None
    try:
        parsed = json.loads(v)
    except Exception:
        raise ValueError("Must be valid JSON")
    if not isinstance(parsed, list) or not all(isinstance(x, str) for x in parsed):
        raise ValueError("Must be a JSON array of strings")
    if len(parsed) > 20:
        raise ValueError("Too many entries (max 20)")
    if any(len(x) > 120 for x in parsed):
        raise ValueError("Entry too long (max 120 chars)")
    return json.dumps(parsed, ensure_ascii=False)


def _valid_json_bool_dict(v: str | None) -> str | None:
    """Validate a Text column that must hold a JSON object of booleans."""
    if v is None or v == "":
        return None
    try:
        parsed = json.loads(v)
    except Exception:
        raise ValueError("Must be valid JSON")
    if not isinstance(parsed, dict) or not all(
        isinstance(k, str) and isinstance(val, bool) for k, val in parsed.items()
    ):
        raise ValueError("Must be a JSON object of booleans")
    if len(parsed) > 30:
        raise ValueError("Too many keys")
    return json.dumps(parsed)


class GroupResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    description_long: str | None = None
    conduct: str | None = None
    category: str | None = None
    family: str | None = None
    categories: str | None = None
    image_url: str | None = None
    logo_url: str | None = None
    location: str | None = None
    group_type: str = "organic"
    entity_id: int | None = None
    is_open: bool = True
    visibility_config: str | None = None
    membership_config: str | None = None
    created_by: int
    created_at: datetime | None = None
    status: str = "active"

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=3, max_length=100)
    description: str | None = Field(None, max_length=2000)
    description_long: str | None = Field(None, max_length=20000)
    conduct: str | None = Field(None, max_length=10000)
    category: str | None = Field(None, max_length=100)
    family: str | None = Field(None, max_length=50)
    categories: str | None = None
    image_url: str | None = Field(None, max_length=500)
    logo_url: str | None = Field(None, max_length=500)
    location: str | None = Field(None, max_length=255)
    group_type: Literal["organic", "structured"] = "organic"
    entity_id: int | None = None
    is_open: bool = True
    visibility_config: str | None = None
    membership_config: str | None = None

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not SLUG_RE.match(v):
            raise ValueError("Slug must be lowercase letters, numbers and hyphens (e.g. 'horta-do-bairro')")
        return v

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name too short")
        return v

    _categories = field_validator("categories")(_valid_json_string_list)
    _vis = field_validator("visibility_config")(_valid_json_bool_dict)
    _mem = field_validator("membership_config")(_valid_json_bool_dict)
    _img = field_validator("image_url")(_valid_url)
    _logo = field_validator("logo_url")(_valid_url)


class GroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = Field(None, max_length=2000)
    description_long: str | None = Field(None, max_length=20000)
    conduct: str | None = Field(None, max_length=10000)
    category: str | None = Field(None, max_length=100)
    family: str | None = Field(None, max_length=50)
    categories: str | None = None
    image_url: str | None = Field(None, max_length=500)
    logo_url: str | None = Field(None, max_length=500)
    location: str | None = Field(None, max_length=255)
    group_type: Literal["organic", "structured"] | None = None
    entity_id: int | None = None
    is_open: bool | None = None
    visibility_config: str | None = None
    membership_config: str | None = None

    _categories = field_validator("categories")(_valid_json_string_list)
    _vis = field_validator("visibility_config")(_valid_json_bool_dict)
    _mem = field_validator("membership_config")(_valid_json_bool_dict)
    _img = field_validator("image_url")(_valid_url)
    _logo = field_validator("logo_url")(_valid_url)


class GroupMemberResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    role: str
    created_at: datetime | None = None
    user_name: str | None = None
    user_avatar: str | None = None

    model_config = {"from_attributes": True}


class GroupContactResponse(BaseModel):
    id: int
    group_id: int
    label: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    hours: str | None = None
    is_public: bool = False

    model_config = {"from_attributes": True}


class GroupContactCreate(BaseModel):
    label: str = Field("Sede", min_length=1, max_length=100)
    address: str | None = Field(None, max_length=1000)
    phone: str | None = Field(None, max_length=50)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=500)
    hours: str | None = Field(None, max_length=255)
    is_public: bool = False

    _phone = field_validator("phone")(_valid_phone)
    _website = field_validator("website")(_valid_url)


class GroupContactUpdate(BaseModel):
    """Partial update for an existing contact — every field optional."""
    label: str | None = Field(None, min_length=1, max_length=100)
    address: str | None = Field(None, max_length=1000)
    phone: str | None = Field(None, max_length=50)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=500)
    hours: str | None = Field(None, max_length=255)
    is_public: bool | None = None

    _phone = field_validator("phone")(_valid_phone)
    _website = field_validator("website")(_valid_url)


class GroupBoardMemberResponse(BaseModel):
    id: int
    group_id: int
    body_name: str
    member_name: str
    role: str | None = None
    term_start: str | None = None
    term_end: str | None = None
    display_order: int = 0

    model_config = {"from_attributes": True}


class GroupBoardMemberCreate(BaseModel):
    body_name: str = Field(min_length=1, max_length=100)
    member_name: str = Field(min_length=1, max_length=200)
    role: str | None = Field(None, max_length=100)
    term_start: str | None = Field(None, max_length=20)
    term_end: str | None = Field(None, max_length=20)
    display_order: int = Field(0, ge=0, le=10000)


class GroupDocumentResponse(BaseModel):
    id: int
    group_id: int
    title: str
    file_url: str
    doc_type: str = "other"
    is_public: bool = False
    display_order: int = 0

    model_config = {"from_attributes": True}


class GroupDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    file_url: str = Field(max_length=1000)
    doc_type: Literal["estatutos", "relatorio", "ata", "regulamento", "other"] = "other"
    is_public: bool = False
    display_order: int = Field(0, ge=0, le=10000)

    @field_validator("file_url")
    @classmethod
    def _file_url(cls, v: str) -> str:
        out = _valid_url(v)
        if out is None:
            raise ValueError("File URL is required")
        return out


class GroupDocumentUpdate(BaseModel):
    """Partial update for an existing document — every field optional."""
    title: str | None = Field(None, min_length=1, max_length=255)
    file_url: str | None = Field(None, max_length=1000)
    doc_type: Literal["estatutos", "relatorio", "ata", "regulamento", "other"] | None = None
    is_public: bool | None = None
    display_order: int | None = Field(None, ge=0, le=10000)

    @field_validator("file_url")
    @classmethod
    def _file_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        out = _valid_url(v)
        if out is None:
            raise ValueError("File URL cannot be empty")
        return out


class GroupProgramResponse(BaseModel):
    id: int
    group_id: int
    name: str
    description: str | None = None
    display_order: int = 0

    model_config = {"from_attributes": True}


class GroupProgramCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    display_order: int = Field(0, ge=0, le=10000)


class GroupProgramSubFieldResponse(BaseModel):
    id: int
    program_id: int
    name: str
    description: str | None = None
    parent_id: int | None = None
    display_order: int = 0

    model_config = {"from_attributes": True}


class GroupProgramSubFieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    parent_id: int | None = None
    display_order: int = Field(0, ge=0, le=10000)


class GroupAnnouncementResponse(BaseModel):
    id: int
    group_id: int
    author_id: int
    body: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class GroupAnnouncementCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class GroupChatLinkResponse(BaseModel):
    id: int
    group_id: int
    name: str
    url: str
    description: str | None = None
    display_order: int = 0

    model_config = {"from_attributes": True}


class GroupChatLinkCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    url: str = Field(max_length=500)
    description: str | None = Field(None, max_length=255)
    display_order: int = Field(0, ge=0, le=10000)

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^https?://[^\s]+$", v, re.IGNORECASE):
            raise ValueError("Must be a full http(s) link (e.g. https://chat.whatsapp.com/...)")
        return v


class GroupInviteResponse(BaseModel):
    id: int
    group_id: int
    invited_by: int
    invited_user_id: int | None = None
    invite_token: str
    method: str
    status: str = "pending"
    expires_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class GroupJoinRequestResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    note: str | None = None
    status: str = "pending"
    created_at: datetime | None = None
    user_name: str | None = None
    user_avatar: str | None = None

    model_config = {"from_attributes": True}


class GroupJoinRequestCreate(BaseModel):
    note: str | None = Field(None, max_length=1000)


class GroupGalleryItemResponse(BaseModel):
    id: int
    group_id: int
    image_url: str
    caption: str | None = None
    album: str | None = None
    uploaded_by: int
    display_order: int = 0

    model_config = {"from_attributes": True}


class GroupGalleryItemCreate(BaseModel):
    image_url: str = Field(max_length=1000)
    caption: str | None = Field(None, max_length=500)
    album: str | None = Field(None, max_length=100)
    display_order: int = Field(0, ge=0, le=10000)

    @field_validator("image_url")
    @classmethod
    def _image_url(cls, v: str) -> str:
        out = _valid_url(v)
        if out is None:
            raise ValueError("Image URL is required")
        return out


# ── Graduation ──────────────────────────────────────────────────────────────

LEGAL_FORMS = ("associacao", "cooperativa", "sociedade", "fundacao", "ipss", "misericordia", "outra")


def _valid_nipc(v: str) -> str:
    """Validate a Portuguese NIPC (9-digit entity ID with check digit)."""
    v = v.strip().replace(" ", "").replace("-", "")
    if not v.isdigit() or len(v) != 9:
        raise ValueError("NIPC deve ter 9 dígitos")
    digits = [int(d) for d in v]
    weights = [9, 8, 7, 6, 5, 4, 3, 2]
    s = sum(d * w for d, w in zip(digits[:8], weights))
    check = 11 - (s % 11)
    if check >= 10:
        check = 0
    if check != digits[8]:
        raise ValueError("NIPC inválido (dígito de controlo incorreto)")
    return v


class GroupGraduationRequestCreate(BaseModel):
    nipc: str = Field(min_length=9, max_length=20)
    legal_form: Literal["associacao", "cooperativa", "sociedade", "fundacao", "ipss", "misericordia", "outra"]
    organization_name: str = Field(min_length=2, max_length=255)
    certificate_url: str | None = Field(None, max_length=1000)
    notes: str | None = Field(None, max_length=2000)

    _nipc = field_validator("nipc")(_valid_nipc)


class GroupGraduationRequestResponse(BaseModel):
    id: int
    group_id: int
    requested_by: int
    nipc: str
    legal_form: str
    organization_name: str
    certificate_url: str | None = None
    notes: str | None = None
    status: str = "pending"
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
