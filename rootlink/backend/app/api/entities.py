"""Entity dissolution + entity-level ban endpoints — docs/roles-permissions/ROLES_PERMISSIONS.md §3
"Entity dissolution" / "Cross-entity ban cascade". Phase 5 adds: self-service
registration + verification review (docs/roles-permissions/assessment.md §5.2/§10a), document
upload, and the entity-scoped "manage my team" surface (docs/roles-permissions/ROLES_PERMISSIONS.md §3).
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.entity_resolution import resolve_entity_and_rank
from app.core.permissions import can
from app.core.permissions_registry import Rank
from app.core.security import get_current_user, hash_password
from app.models.entity import Entity
from app.models.moderation import ModerationAction
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.entity import (
    DissolutionActionRequest,
    EntityBanRequest,
    EntityDocumentResponse,
    EntityMemberPasswordResetRequest,
    EntityMemberResponse,
    EntityNotifyMembersRequest,
    EntityRegisterRequest,
    EntityResponse,
    EntityVerificationDecisionRequest,
    TeamRosterAddRequest,
)
from app.schemas.moderation import SelfPublishGrant
from app.services.audit import log_moderation
from app.services.document_storage import storage as document_storage
from app.services.entity_dissolution import (
    DissolutionError,
    approve_dissolution,
    ban_entity,
    reject_dissolution,
    request_dissolution,
    reverse_dissolution,
    unban_entity,
)
from app.services.entity_documents import EntityDocumentError, can_manage_entity_documents
from app.services.entity_documents import list_documents as _list_documents
from app.services.entity_documents import upload_document as _upload_document
from app.services.entity_registration import (
    EntityRegistrationError,
    approve_verification,
    register_entity,
    reject_verification,
    request_more_info,
)
from app.services.entity_team import (
    TeamManagementError,
    add_team_member,
    can_view_team,
    list_members,
    remove_team_member,
)
from app.services.sessions import revoke_all_user_sessions
from app.services.trust import self_publish_eligibility

router = APIRouter(prefix="/api/entities", tags=["entities"])


async def _get_entity(db: AsyncSession, entity_id: int) -> Entity:
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


def _require_platform_super_admin(user: User) -> None:
    entity_kind, rank = resolve_entity_and_rank(user)
    if entity_kind != "platform" or rank < Rank.super_admin:
        raise HTTPException(status_code=403, detail="Platform super admin only")


def _require_verification_authority(user: User) -> None:
    """docs/roles-permissions/ROLES_PERMISSIONS.md §8: "Verify an organization/practitioner account" is
    admin(4)+, platform-wide — not super-admin-only like dissolution/ban."""
    if not can(user, "entity.verify_organization_practitioner"):
        raise HTTPException(status_code=403, detail="Platform admin or super admin only")


# --- Self-service registration + verification review (docs/roles-permissions/assessment.md §5.2/§10a) ---


@router.post("/register", response_model=EntityResponse, status_code=201)
async def register_entity_endpoint(
    body: EntityRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        entity = await register_entity(
            db, current_user, entity_type=body.entity_type, name=body.name,
            tax_registration_id=body.tax_registration_id,
            tax_registration_scheme=body.tax_registration_scheme,
        )
    except EntityRegistrationError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.get("/verification-queue", response_model=list[EntityResponse])
async def verification_queue(
    status: str = Query("pending", description="pending | more_info_requested | rejected | verified"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_verification_authority(current_user)
    rows = (
        await db.execute(select(Entity).where(Entity.verification_status == status))
    ).scalars().all()
    return list(rows)


@router.get("/mine", response_model=EntityResponse)
async def my_entity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The current user's own entity — either already-bootstrapped
    (`entity_id` set) or still pending verification (registrant of a
    not-yet-verified entity, tracked via `primary_contact_user_id` during
    the pending window — see entity_registration.py's module docstring)."""
    entity: Entity | None = None
    if current_user.entity_id is not None:
        entity = await db.get(Entity, current_user.entity_id)
    if entity is None:
        entity = (
            await db.execute(
                select(Entity).where(
                    Entity.primary_contact_user_id == current_user.id,
                    Entity.verification_status != "verified",
                )
            )
        ).scalars().first()
    if entity is None:
        raise HTTPException(status_code=404, detail="No entity found for this user")
    return entity


@router.post("/{entity_id}/verification/approve", response_model=EntityResponse)
async def approve_verification_endpoint(
    entity_id: int,
    body: EntityVerificationDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_verification_authority(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await approve_verification(db, current_user, entity, reason=body.reason)
    except EntityRegistrationError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.post("/{entity_id}/verification/reject", response_model=EntityResponse)
async def reject_verification_endpoint(
    entity_id: int,
    body: EntityVerificationDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_verification_authority(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await reject_verification(db, current_user, entity, reason=body.reason)
    except EntityRegistrationError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.post("/{entity_id}/verification/request-more-info", response_model=EntityResponse)
async def request_more_info_endpoint(
    entity_id: int,
    body: EntityVerificationDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_verification_authority(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await request_more_info(db, current_user, entity, reason=body.reason)
    except EntityRegistrationError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


# --- Verification documents (docs/roles-permissions/assessment.md §10a) ---


@router.post("/{entity_id}/documents", response_model=EntityDocumentResponse, status_code=201)
async def upload_entity_document(
    entity_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity = await _get_entity(db, entity_id)
    if not can_manage_entity_documents(current_user, entity) and not can(
        current_user, "entity.verify_organization_practitioner"
    ):
        raise HTTPException(status_code=403, detail="Not authorized to upload documents for this entity")
    raw = await file.read()
    try:
        doc = await _upload_document(
            db, current_user, entity,
            data=raw, filename=file.filename or "document",
            content_type=file.content_type or "application/octet-stream",
        )
    except EntityDocumentError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/{entity_id}/documents", response_model=list[EntityDocumentResponse])
async def list_entity_documents(
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity = await _get_entity(db, entity_id)
    if not can_manage_entity_documents(current_user, entity) and not can(
        current_user, "entity.verify_organization_practitioner"
    ):
        raise HTTPException(status_code=403, detail="Not authorized to view documents for this entity")
    return await _list_documents(db, entity_id)


@router.get("/{entity_id}/documents/{document_id}/serve")
async def serve_entity_document(
    entity_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.entity import EntityDocument

    entity = await _get_entity(db, entity_id)
    if not can_manage_entity_documents(current_user, entity) and not can(
        current_user, "entity.verify_organization_practitioner"
    ):
        raise HTTPException(status_code=403, detail="Not authorized to view documents for this entity")
    doc = await db.get(EntityDocument, document_id)
    if not doc or doc.entity_id != entity_id:
        raise HTTPException(status_code=404, detail="Document not found")
    path = document_storage.get_path(doc.storage_path)
    if not path:
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(str(path), media_type=doc.content_type, filename=doc.filename)


# --- Entity-scoped "manage my team" (docs/roles-permissions/ROLES_PERMISSIONS.md §3) ---


@router.get("/{entity_id}/members", response_model=list[EntityMemberResponse])
async def entity_members(
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity = await _get_entity(db, entity_id)
    if not can_view_team(current_user, entity) and not can(
        current_user, "entity.verify_organization_practitioner"
    ):
        raise HTTPException(status_code=403, detail="Not authorized to view this entity's team")
    return await list_members(db, entity_id)


@router.post("/{entity_id}/roster", response_model=EntityMemberResponse)
async def add_roster_member(
    entity_id: int,
    body: TeamRosterAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity = await _get_entity(db, entity_id)
    target = await db.get(User, body.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        target = await add_team_member(db, current_user, entity, target)
    except TeamManagementError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{entity_id}/roster/{user_id}", response_model=EntityMemberResponse)
async def remove_roster_member(
    entity_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity = await _get_entity(db, entity_id)
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        target = await remove_team_member(db, current_user, entity, target)
    except TeamManagementError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(target)
    return target


# --- Entity-scoped member account admin (docs/roles-permissions/ROLES_PERMISSIONS.md §7
# "password.reset_entity_member" / "trusted_publisher.grant_revoke_entity").
# Both paths start with `{entity_id}` so ordering relative to the catch-all
# GET /{entity_id} below is safe (docs/LESSONS.md #31 only bites literal-path
# first segments). ---


def _require_member_admin_authority(current_user: User, entity: Entity, action: str) -> None:
    """Same-entity super admin, or platform (via `can()`'s platform branch).

    `can()` already enforces the registry floor + same-entity matching.
    `trusted_publisher.grant_revoke_entity`'s registry floor is admin(4) —
    its ☑️ tier, meaning "on below-rank users", a target-rank axis `can()`
    can't express — so this surface additionally holds non-platform actors
    to the 🔑 super-admin tier for both actions, matching
    `password.reset_entity_member`'s floor.
    """
    if can(current_user, action, entity_id=entity.id):
        entity_kind, rank = resolve_entity_and_rank(current_user)
        if entity_kind == "platform" or rank >= Rank.super_admin:
            return
    raise HTTPException(status_code=403, detail="Entity super admin or platform super admin only")


async def _get_entity_member(db: AsyncSession, entity_id: int, user_id: int) -> User:
    """Target must belong to THIS entity — 404 either way (not found /
    other entity) so membership elsewhere isn't leaked."""
    target = await db.get(User, user_id)
    if not target or target.entity_id != entity_id:
        raise HTTPException(status_code=404, detail="User is not a member of this entity")
    return target


@router.post("/{entity_id}/members/{user_id}/reset-password")
async def reset_member_password(
    entity_id: int,
    user_id: int,
    body: EntityMemberPasswordResetRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity = await _get_entity(db, entity_id)
    _require_member_admin_authority(current_user, entity, "password.reset_entity_member")
    target = await _get_entity_member(db, entity_id, user_id)
    target.password_hash = hash_password(body.password)
    # Same rule as the self-service reset (app/api/auth_security.py): old
    # sessions must not survive a password reset.
    await revoke_all_user_sessions(db, target.id, reason=f"password reset by entity admin {current_user.id}")
    await log_moderation(
        db, action=ModerationAction.reset_member_password, target_type="user",
        target_id=target.id, actor_id=current_user.id, meta={"entity_id": entity_id},
    )
    await db.commit()
    return {"ok": True}


@router.patch("/{entity_id}/members/{user_id}/self-publish")
async def set_member_self_publish(
    entity_id: int,
    user_id: int,
    body: SelfPublishGrant,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Entity-scoped grant/revoke of trusted-author self-publishing — mirrors
    the platform endpoint (app/api/admin.py set_self_publish), including the
    eligibility + agreement checks on grant; only a PLATFORM super admin may
    override those, same as the template's super_admin override."""
    entity = await _get_entity(db, entity_id)
    _require_member_admin_authority(current_user, entity, "trusted_publisher.grant_revoke_entity")
    target = await _get_entity_member(db, entity_id, user_id)
    if body.grant:
        entity_kind, rank = resolve_entity_and_rank(current_user)
        is_platform_super = entity_kind == "platform" and rank >= Rank.super_admin
        if not is_platform_super:
            elig = await self_publish_eligibility(db, target)
            if not elig["eligible"]:
                raise HTTPException(status_code=400, detail="User is not eligible for self-publishing")
            if not elig["agreed"]:
                raise HTTPException(
                    status_code=400,
                    detail="User has not accepted the publisher responsibility agreement",
                )
        target.can_self_publish = True
        action = ModerationAction.grant_self_publish
    else:
        target.can_self_publish = False
        action = ModerationAction.revoke_self_publish
    await log_moderation(
        db, action=action, target_type="user", target_id=target.id,
        actor_id=current_user.id, meta={"entity_id": entity_id, "scope": "entity"},
    )
    await db.commit()
    return {"ok": True, "can_self_publish": target.can_self_publish}


# --- Entity-scoped notification broadcast (docs/roles-permissions/ROLES_PERMISSIONS.md
# §7 "notification.send_to_entity_members") — the entity-scoped sibling of the
# platform-wide POST /api/admin/broadcast. Path starts with `{entity_id}`, so
# ordering relative to the catch-all GET /{entity_id} is safe (docs/LESSONS.md
# #31 only bites literal-path first segments). ---


def _require_entity_notify_authority(current_user: User, entity: Entity) -> None:
    """Same-entity admin(4)+, or platform admin(4)+ (via `can()`'s platform
    branch). Unlike `_require_member_admin_authority` above — which holds
    non-platform actors to the super-admin 🔑 tier because those actions'
    registry floors demand it — the registry floor for
    `notification.send_to_entity_members` is admin(4) with no higher ☑️/🔑
    tier, so `can()` alone expresses this gate exactly."""
    if not can(current_user, "notification.send_to_entity_members", entity_id=entity.id):
        raise HTTPException(status_code=403, detail="Entity admin or platform admin only")


@router.post("/{entity_id}/notify-members")
async def notify_entity_members(
    entity_id: int,
    body: EntityNotifyMembersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a notification to every member of this entity except the sender —
    same Notification mechanics as the platform broadcast (app/api/admin.py
    broadcast_notification), scoped to `User.entity_id == entity_id`."""
    entity = await _get_entity(db, entity_id)
    _require_entity_notify_authority(current_user, entity)
    result = await db.execute(
        select(User.id).where(User.entity_id == entity_id, User.id != current_user.id)
    )
    user_ids = result.scalars().all()
    for uid in user_ids:
        db.add(Notification(
            user_id=uid,
            actor_id=current_user.id,
            type=NotificationType.system,
            message=body.message,
            link=f"/entity/{entity_id}",
        ))
    await log_moderation(
        db, action=ModerationAction.notify_entity_members, target_type="entity",
        target_id=entity_id, actor_id=current_user.id,
        meta={"entity_id": entity_id, "sent_to": len(user_ids)},
    )
    await db.commit()
    return {"sent_to": len(user_ids)}


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(
    entity_id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_entity(db, entity_id)


@router.post("/{entity_id}/dissolve", response_model=EntityResponse)
async def dissolve_entity_endpoint(
    entity_id: int,
    body: DissolutionActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Triggers dissolution. Per docs/roles-permissions/ROLES_PERMISSIONS.md §3: the entity's own super
    admin may only REQUEST it (pending platform review); the platform super
    admin's call executes it immediately (it's already the only approval
    authority)."""
    entity = await _get_entity(db, entity_id)
    entity_kind, rank = resolve_entity_and_rank(current_user)
    is_platform_super_admin = entity_kind == "platform" and rank >= Rank.super_admin
    is_own_super_admin = (
        entity_kind == entity.entity_type and current_user.entity_id == entity.id and rank >= Rank.super_admin
    )
    if not is_platform_super_admin and not is_own_super_admin:
        raise HTTPException(status_code=403, detail="Entity super admin or platform super admin only")

    try:
        if is_platform_super_admin:
            entity = await approve_dissolution(
                db, entity, current_user, reason=body.reason, triggered_directly=True,
            )
        else:
            entity = await request_dissolution(db, entity, current_user, reason=body.reason)
    except DissolutionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.post("/{entity_id}/dissolve/approve", response_model=EntityResponse)
async def approve_dissolution_endpoint(
    entity_id: int,
    body: DissolutionActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_platform_super_admin(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await approve_dissolution(db, entity, current_user, reason=body.reason)
    except DissolutionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.post("/{entity_id}/dissolve/reject", response_model=EntityResponse)
async def reject_dissolution_endpoint(
    entity_id: int,
    body: DissolutionActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_platform_super_admin(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await reject_dissolution(db, entity, current_user, reason=body.reason)
    except DissolutionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.post("/{entity_id}/reverse-dissolution", response_model=EntityResponse)
async def reverse_dissolution_endpoint(
    entity_id: int,
    body: DissolutionActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_platform_super_admin(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await reverse_dissolution(db, entity, current_user, reason=body.reason)
    except DissolutionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.post("/{entity_id}/ban", response_model=EntityResponse)
async def ban_entity_endpoint(
    entity_id: int,
    body: EntityBanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_platform_super_admin(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await ban_entity(db, entity, current_user, reason=body.reason)
    except DissolutionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.post("/{entity_id}/unban", response_model=EntityResponse)
async def unban_entity_endpoint(
    entity_id: int,
    body: EntityBanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_platform_super_admin(current_user)
    entity = await _get_entity(db, entity_id)
    try:
        entity = await unban_entity(db, entity, current_user, reason=body.reason)
    except DissolutionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(entity)
    return entity
