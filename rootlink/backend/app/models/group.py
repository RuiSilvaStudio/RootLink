import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Boolean, JSON, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MemberRole(enum.StrEnum):
    """Group-level roles (separate from platform-wide roles).

    Per §9.1.6: simplified to owner/staff/member. Legacy values (admin,
    moderator) are kept for backward-compat during migration — the lifespan
    migrates admin→owner, moderator→staff on startup.
    """
    member = "member"
    staff = "staff"
    owner = "owner"
    # Legacy (migrated to owner/staff on startup, kept for enum compat)
    admin = "admin"
    moderator = "moderator"


class GroupType(enum.StrEnum):
    organic = "organic"
    structured = "structured"


class GroupStatus(enum.StrEnum):
    active = "active"
    archived = "archived"


class Group(TimestampMixin, Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_long: Mapped[str | None] = mapped_column(Text, nullable=True)
    conduct: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    family: Mapped[str | None] = mapped_column(String(50), nullable=True)
    categories: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    group_type: Mapped[str] = mapped_column(String(20), default=GroupType.organic)
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    visibility_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    membership_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=GroupStatus.active)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GroupMember(TimestampMixin, Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_members_group_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20), default=MemberRole.member)


class GroupContact(TimestampMixin, Base):
    __tablename__ = "group_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    label: Mapped[str] = mapped_column(String(100), default="Sede")
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hours: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class GroupBoardMember(TimestampMixin, Base):
    """Órgãos sociais — direção, conselho fiscal, assembleia geral (§11.4 A4)."""
    __tablename__ = "group_board_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    body_name: Mapped[str] = mapped_column(String(100))
    member_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    term_start: Mapped[str | None] = mapped_column(String(20), nullable=True)
    term_end: Mapped[str | None] = mapped_column(String(20), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class GroupDocument(TimestampMixin, Base):
    """Documents repository — estatutos, relatórios, atas (§11.4 A6)."""
    __tablename__ = "group_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    file_url: Mapped[str] = mapped_column(String(1000))
    doc_type: Mapped[str] = mapped_column(String(50), default="other")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class GroupProgram(TimestampMixin, Base):
    """Managed programs — futebol, seed library, música (§11.5)."""
    __tablename__ = "group_programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class GroupProgramSubField(TimestampMixin, Base):
    """Sub-fields within programs — Iniciados 5-8, Juvenis 9-12 (§11.5).

    Supports a 3-level hierarchy (Program → category → item): a sub-field
    with a null parent_id is a *category* (Infantis, Juvenis); a sub-field
    whose parent_id points at a category is an *item* (5 aos 8 anos, 2 equipas).
    Nesting stops there — items can't have children (max depth = 3)."""
    __tablename__ = "group_program_subfields"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("group_programs.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("group_program_subfields.id"), nullable=True, index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class GroupAnnouncement(TimestampMixin, Base):
    """Owner-posted announcements — member-only (§9.4.1)."""
    __tablename__ = "group_announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)


class GroupChatLink(TimestampMixin, Base):
    """External chat links — WhatsApp, Telegram (§9.4.2). Members-only."""
    __tablename__ = "group_chat_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class GroupInvite(TimestampMixin, Base):
    """Sent invitations with status tracking (§9.1.1-1.3)."""
    __tablename__ = "group_invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    invited_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invited_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    invite_token: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    method: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GroupJoinRequest(TimestampMixin, Base):
    """Pending join requests from prospect QR / closed groups (§9.1.5)."""
    __tablename__ = "group_join_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")


class GroupContent(TimestampMixin, Base):
    """Join table linking events/articles/courses/waste hubs to groups.

    Supports multi-group per Q3.1 — an item can belong to multiple groups.
    Polymorphic: content_type discriminates which table content_id points to.

    `is_public` controls per-link visibility: a course linked as private is
    only visible to group members; a course linked as public is visible to
    everyone. Events and articles ignore this flag (they follow the group's
    section visibility config); courses use it for per-course control.
    """
    __tablename__ = "group_content"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    content_type: Mapped[str] = mapped_column(String(50))
    content_id: Mapped[int] = mapped_column(Integer, index=True)
    linked_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")


class GroupGalleryItem(TimestampMixin, Base):
    """Standalone photo gallery uploads (§11.4 A5)."""
    __tablename__ = "group_gallery_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    image_url: Mapped[str] = mapped_column(String(1000))
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)
    album: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class Follow(TimestampMixin, Base):
    __tablename__ = "follows"

    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    following_id: Mapped[int] = mapped_column(ForeignKey("users.id"))


class GroupGraduationRequest(TimestampMixin, Base):
    """Graduation request — informal group → formal organization (§9.6).

    The group owner initiates the transition by providing the organization's
    legal registration info (NIPC, legal form, certificate). A super_admin
    reviews and approves/rejects. On approval, the group's group_type changes
    from 'organic' to 'structured' (irreversible per §9.6.3).
    """
    __tablename__ = "group_graduation_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    nipc: Mapped[str] = mapped_column(String(20))  # 9-digit Portuguese entity ID
    legal_form: Mapped[str] = mapped_column(String(50))  # associacao, cooperativa, etc.
    organization_name: Mapped[str] = mapped_column(String(255))  # official registered name
    certificate_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/approved/rejected
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
