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
from app.core.security import get_current_user
from app.models.entity import Entity
from app.models.user import User
from app.schemas.entity import (
    DissolutionActionRequest,
    EntityBanRequest,
    EntityDocumentResponse,
    EntityMemberResponse,
    EntityRegisterRequest,
    EntityResponse,
    EntityVerificationDecisionRequest,
    TeamRosterAddRequest,
)
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
