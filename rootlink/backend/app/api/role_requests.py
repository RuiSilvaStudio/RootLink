"""Promote/demote request+approval workflow endpoints — docs/roles-permissions/ROLES_PERMISSIONS.md §6.
Backend-only (Phase 5 builds the "submit a request / see pending approvals"
UI) — see docs/roles-permissions/roadmap.md's Phase 4/5 split.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.role_request import RoleChangeRequest, RoleChangeStatus
from app.models.user import User
from app.schemas.entity import (
    RoleChangeDecisionRequest,
    RoleChangeRequestResponse,
    RoleChangeSubmitRequest,
)
from app.services.role_requests import (
    RoleRequestError,
    approve_role_change_request,
    can_approve,
    reject_role_change_request,
    submit_role_change_request,
)

router = APIRouter(prefix="/api/role-requests", tags=["role-requests"])


@router.get("", response_model=list[RoleChangeRequestResponse])
async def list_role_requests(
    scope: str = Query("mine", description="mine | pending-approval"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Phase 5 addition — only `GET /{id}` (single-request lookup) existed
    before. `scope=mine`: requests I submitted (any status). `scope=pending-approval`:
    pending requests I'm currently eligible to decide — filtered in Python
    over the (small-scale, per docs/roles-permissions/phase0-decisions.md (h) precedent for
    similarly-sized admin surfaces) full pending set, not a SQL-level
    entity/rank join, since the eligibility rule (`can_approve`) already
    exists as a single well-tested Python function and duplicating its
    logic as a query would be exactly the kind of "same rule expressed
    twice, can drift" pattern this whole redesign exists to avoid."""
    if scope == "mine":
        rows = (
            await db.execute(
                select(RoleChangeRequest).where(RoleChangeRequest.requested_by == current_user.id)
            )
        ).scalars().all()
        return list(rows)

    if scope == "pending-approval":
        pending = (
            await db.execute(
                select(RoleChangeRequest).where(RoleChangeRequest.status == RoleChangeStatus.pending)
            )
        ).scalars().all()
        return [r for r in pending if can_approve(current_user, r)]

    raise HTTPException(status_code=400, detail="scope must be 'mine' or 'pending-approval'")


@router.post("", response_model=RoleChangeRequestResponse, status_code=201)
async def submit_role_request(
    body: RoleChangeSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, body.target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    try:
        request = await submit_role_change_request(
            db, current_user, target, to_rank=body.to_rank, reason=body.reason,
        )
    except RoleRequestError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(request)
    return request


@router.get("/{request_id}", response_model=RoleChangeRequestResponse)
async def get_role_request(
    request_id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    request = await db.get(RoleChangeRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request


@router.post("/{request_id}/approve", response_model=RoleChangeRequestResponse)
async def approve_role_request(
    request_id: int,
    body: RoleChangeDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    request = await db.get(RoleChangeRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    target = await db.get(User, request.target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    try:
        request = await approve_role_change_request(db, current_user, request, target, reason=body.reason)
    except RoleRequestError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(request)
    return request


@router.post("/{request_id}/reject", response_model=RoleChangeRequestResponse)
async def reject_role_request(
    request_id: int,
    body: RoleChangeDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    request = await db.get(RoleChangeRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    try:
        request = await reject_role_change_request(db, current_user, request, reason=body.reason)
    except RoleRequestError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(request)
    return request
