"""Entity conversion endpoints — docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity conversion
(lifecycle)". Backend-only (Phase 5 builds the UI: eligibility check,
"what's lost" messaging, confirmation step) — see
docs/roles-permissions/roadmap.md's Phase 4/5 split.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.entity import ConvertToOrganizationRequest, ConvertToProfessionalRequest
from app.services.entity_conversion import (
    ConversionError,
    convert_individual_to_professional,
    convert_professional_to_organization,
)

router = APIRouter(prefix="/api/entity-conversion", tags=["entity-conversion"])


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
