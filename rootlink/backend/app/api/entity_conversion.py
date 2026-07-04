"""Entity conversion endpoints — docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity conversion
(lifecycle)". Self-service only: every endpoint here resolves the acting
user via `Depends(get_current_user)` — there is no `user_id` path/body
parameter anywhere in this router, so there is no admin-triggered path
(docs/roles-permissions/phase0-decisions.md Addendum 5).

`GET /preview` is a read-only dry-run (no DB writes) — it must be called,
and its comparison rendered + explicitly confirmed, by the frontend BEFORE
`POST /to-professional`/`/to-individual` is ever called for real (Addendum
5, decision 2's mandatory live-comparison + consent-gate requirement).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.entity import (
    ConvertToOrganizationRequest,
    ConvertToProfessionalRequest,
    EntityConversionPreviewResponse,
)
from app.services.entity_conversion import (
    ConversionError,
    compute_conversion_preview,
    convert_individual_to_professional,
    convert_professional_to_individual,
    convert_professional_to_organization,
)

router = APIRouter(prefix="/api/entity-conversion", tags=["entity-conversion"])


@router.get("/preview", response_model=EntityConversionPreviewResponse)
async def preview_conversion(
    to: str = Query(..., description="Destination entity kind: individual|professional"),
    current_user: User = Depends(get_current_user),
):
    """Read-only dry-run for the caller's OWN account — see this module's
    docstring. Never mutates anything; safe to call as often as the
    frontend needs (e.g. re-check right before rendering the consent
    checkbox)."""
    try:
        return compute_conversion_preview(current_user, to)
    except ConversionError as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/to-professional", response_model=UserResponse)
async def convert_to_professional(
    body: ConvertToProfessionalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await convert_individual_to_professional(
            db, current_user,
            tax_registration_id=body.tax_registration_id,
            activity_registration_number=body.activity_registration_number,
        )
    except ConversionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/to-individual", response_model=UserResponse)
async def convert_to_individual(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await convert_professional_to_individual(db, current_user)
    except ConversionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/to-organization", response_model=UserResponse)
async def convert_to_organization(
    body: ConvertToOrganizationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        user, _entity = await convert_professional_to_organization(
            db, current_user, organization_name=body.organization_name,
        )
    except ConversionError as e:
        raise HTTPException(status_code=400, detail=e.detail)
    await db.commit()
    await db.refresh(user)
    return user
