"""Delegation-grant CRUD endpoints (docs/roles-permissions/ROLES_PERMISSIONS.md §10) — Phase 5.

See `app.services.delegations` module docstring for the authority model
(entity super admin or platform super admin may grant/revoke; no
self-delegation) and for what's deliberately NOT wired in yet
(auto-void-on-demotion).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entity import DelegationGrant
from app.models.user import User
from app.schemas.entity import (
    DelegationGrantRequest,
    DelegationGrantResponse,
    DelegationRevokeRequest,
)
from app.services.delegations import (
    DelegationError,
    grant_delegation,
    has_grantor_authority,
    list_delegations,
    revoke_delegation,
)

router = APIRouter(prefix="/api/delegations", tags=["delegations"])


@router.post("", response_model=DelegationGrantResponse, status_code=201)
async def create_delegation(
    body: DelegationGrantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    grantee = await db.get(User, body.grantee_id)
    if not grantee:
        raise HTTPException(status_code=404, detail="Grantee not found")
    try:
        grant = await grant_delegation(
            db, current_user, grantee=grantee, action=body.action, entity_id=body.entity_id,
        )
    except DelegationError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(grant)
    return grant


@router.get("", response_model=list[DelegationGrantResponse])
async def get_delegations(
    entity_id: int | None = Query(None),
    mine: bool = Query(False, description="Only grants where I am the grantee"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if mine:
        return await list_delegations(db, grantee_id=current_user.id)

    if entity_id is not None:
        # Viewing an entity's grant list requires the same authority needed
        # to grant/revoke within it (entity super admin or platform super
        # admin) — reuses grant_delegation's own authority check via a
        # cheap probe rather than duplicating the rank/entity comparison.
        if not has_grantor_authority(current_user, entity_id):
            raise HTTPException(status_code=403, detail="Not authorized to view this entity's delegations")
        return await list_delegations(db, entity_id=entity_id)

    if not has_grantor_authority(current_user, None):
        raise HTTPException(status_code=403, detail="Platform super admin only for platform-wide delegations")
    return await list_delegations(db, entity_id=None)


@router.post("/{grant_id}/revoke", response_model=DelegationGrantResponse)
async def revoke_delegation_endpoint(
    grant_id: int,
    body: DelegationRevokeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    grant = await db.get(DelegationGrant, grant_id)
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    try:
        grant = await revoke_delegation(db, current_user, grant, reason=body.reason)
    except DelegationError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(grant)
    return grant
