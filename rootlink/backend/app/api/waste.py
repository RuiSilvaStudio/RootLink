import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.waste import (
    CompostingHub, CompostingMember, CompostingDeposit,
    UpcyclingProject, WasteChallenge,
)
from app.schemas.waste import (
    HubResponse, HubCreate, DepositResponse, DepositCreate,
    UpcyclingResponse, UpcyclingCreate,
    ChallengeResponse, ChallengeCreate,
)

logger = logging.getLogger("app.waste")

router = APIRouter(prefix="/api/waste", tags=["waste"])


# ── Composting Hubs ────────────────────────────────────────────────────

@router.get("/hubs", response_model=list[HubResponse])
async def list_hubs(
    q: str | None = Query(None),
    region: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(CompostingHub, User.name, func.count(CompostingMember.id))
        .join(User, CompostingHub.manager_id == User.id, isouter=True)
        .join(CompostingMember, CompostingMember.hub_id == CompostingHub.id, isouter=True)
        .where(CompostingHub.is_public.is_(True), CompostingHub.status != "closed")
        .group_by(CompostingHub.id, User.name)
    )
    if q:
        query = query.where(or_(
            CompostingHub.name.ilike(f"%{q}%"),
            CompostingHub.description.ilike(f"%{q}%"),
            CompostingHub.location.ilike(f"%{q}%"),
        ))
    if region:
        query = query.where(CompostingHub.location.ilike(f"%{region}%"))
    query = query.order_by(CompostingHub.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    hubs = []
    for hub, manager_name, member_count in result.all():
        hubs.append(HubResponse(
            id=hub.id,
            name=hub.name,
            description=hub.description,
            manager_id=hub.manager_id,
            manager_name=manager_name,
            location=hub.location,
            lat=hub.lat,
            lng=hub.lng,
            capacity_kg_week=hub.capacity_kg_week,
            accepted_materials=hub.accepted_materials or [],
            operating_hours=hub.operating_hours,
            is_public=hub.is_public,
            status=hub.status,
            image_url=hub.image_url,
            current_volume_kg=hub.current_volume_kg,
            member_count=member_count or 0,
            created_at=hub.created_at,
        ))
    return hubs


@router.get("/hubs/{hub_id}", response_model=HubResponse)
async def get_hub(hub_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CompostingHub, User.name, func.count(CompostingMember.id))
        .join(User, CompostingHub.manager_id == User.id, isouter=True)
        .join(CompostingMember, CompostingMember.hub_id == CompostingHub.id, isouter=True)
        .where(CompostingHub.id == hub_id)
        .group_by(CompostingHub.id, User.name)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Composting hub not found")
    hub, manager_name, member_count = row
    return HubResponse(
        id=hub.id, name=hub.name, description=hub.description,
        manager_id=hub.manager_id, manager_name=manager_name,
        location=hub.location, lat=hub.lat, lng=hub.lng,
        capacity_kg_week=hub.capacity_kg_week,
        accepted_materials=hub.accepted_materials or [],
        operating_hours=hub.operating_hours,
        is_public=hub.is_public, status=hub.status,
        image_url=hub.image_url, current_volume_kg=hub.current_volume_kg,
        member_count=member_count or 0, created_at=hub.created_at,
    )


@router.post("/hubs", response_model=HubResponse, status_code=201)
async def create_hub(
    body: HubCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub = CompostingHub(
        name=body.name,
        description=body.description,
        manager_id=current_user.id,
        location=body.location,
        lat=body.lat,
        lng=body.lng,
        capacity_kg_week=body.capacity_kg_week,
        accepted_materials=body.accepted_materials,
        operating_hours=body.operating_hours,
        is_public=body.is_public,
        image_url=body.image_url,
    )
    db.add(hub)
    await db.commit()
    await db.refresh(hub)

    # Manager is automatically a member
    member = CompostingMember(hub_id=hub.id, user_id=current_user.id, role="manager")
    db.add(member)
    await db.commit()

    return HubResponse(
        id=hub.id, name=hub.name, description=hub.description,
        manager_id=hub.manager_id, manager_name=current_user.name,
        location=hub.location, lat=hub.lat, lng=hub.lng,
        capacity_kg_week=hub.capacity_kg_week,
        accepted_materials=hub.accepted_materials or [],
        operating_hours=hub.operating_hours,
        is_public=hub.is_public, status=hub.status,
        image_url=hub.image_url, current_volume_kg=hub.current_volume_kg,
        member_count=1, created_at=hub.created_at,
    )


@router.post("/hubs/{hub_id}/join", status_code=201)
async def join_hub(
    hub_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(CompostingMember).where(
            CompostingMember.hub_id == hub_id,
            CompostingMember.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member")
    member = CompostingMember(hub_id=hub_id, user_id=current_user.id, role="member")
    db.add(member)
    await db.commit()
    return {"ok": True}


@router.delete("/hubs/{hub_id}/leave", status_code=204)
async def leave_hub(
    hub_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CompostingMember).where(
            CompostingMember.hub_id == hub_id,
            CompostingMember.user_id == current_user.id,
            CompostingMember.role != "manager",
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member or cannot leave as manager")
    await db.delete(member)
    await db.commit()


# ── Composting Deposits ────────────────────────────────────────────────

@router.post("/hubs/{hub_id}/deposit", response_model=DepositResponse, status_code=201)
async def make_deposit(
    hub_id: int,
    body: DepositCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub_result = await db.execute(select(CompostingHub).where(CompostingHub.id == hub_id))
    hub = hub_result.scalar_one_or_none()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
    if hub.status == "closed":
        raise HTTPException(status_code=400, detail="This hub is closed")

    deposit = CompostingDeposit(
        hub_id=hub_id,
        user_id=current_user.id,
        weight_kg=body.weight_kg,
        material_type=body.material_type,
        notes=body.notes,
    )
    db.add(deposit)
    # Update hub volume
    hub.current_volume_kg = (hub.current_volume_kg or 0) + body.weight_kg
    await db.commit()
    await db.refresh(deposit)

    return DepositResponse(
        id=deposit.id, hub_id=deposit.hub_id, user_id=deposit.user_id,
        user_name=current_user.name, weight_kg=deposit.weight_kg,
        material_type=deposit.material_type, notes=deposit.notes,
        created_at=deposit.created_at,
    )


@router.get("/hubs/{hub_id}/deposits", response_model=list[DepositResponse])
async def list_deposits(
    hub_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CompostingDeposit, User.name)
        .join(User, CompostingDeposit.user_id == User.id, isouter=True)
        .where(CompostingDeposit.hub_id == hub_id)
        .order_by(CompostingDeposit.created_at.desc())
        .limit(limit)
    )
    return [
        DepositResponse(
            id=d.id, hub_id=d.hub_id, user_id=d.user_id,
            user_name=name, weight_kg=d.weight_kg,
            material_type=d.material_type, notes=d.notes,
            created_at=d.created_at,
        )
        for d, name in result.all()
    ]


# ── Upcycling Projects ─────────────────────────────────────────────────

@router.get("/upcycling", response_model=list[UpcyclingResponse])
async def list_upcycling(
    q: str | None = Query(None),
    family: str | None = Query(None),
    difficulty: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(UpcyclingProject, User.name, User.is_verified)
        .join(User, UpcyclingProject.creator_id == User.id, isouter=True)
        .where(UpcyclingProject.status == "published")
    )
    if q:
        query = query.where(or_(
            UpcyclingProject.title.ilike(f"%{q}%"),
            UpcyclingProject.description.ilike(f"%{q}%"),
        ))
    if family:
        query = query.where(UpcyclingProject.family == family)
    if difficulty:
        query = query.where(UpcyclingProject.difficulty == difficulty)
    query = query.order_by(UpcyclingProject.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return [
        UpcyclingResponse(
            id=p.id, creator_id=p.creator_id, creator_name=name,
            creator_verified=verified, title=p.title, description=p.description,
            materials_used=p.materials_used or [], before_images=p.before_images or [],
            after_images=p.after_images or [],
            estimated_waste_diverted_kg=p.estimated_waste_diverted_kg,
            difficulty=p.difficulty, time_spent_hours=p.time_spent_hours,
            status=p.status, family=p.family, category=p.category,
            view_count=p.view_count, created_at=p.created_at,
        )
        for p, name, verified in result.all()
    ]


@router.get("/upcycling/{project_id}", response_model=UpcyclingResponse)
async def get_upcycling(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UpcyclingProject, User.name, User.is_verified)
        .join(User, UpcyclingProject.creator_id == User.id, isouter=True)
        .where(UpcyclingProject.id == project_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    p, name, verified = row
    p.view_count = (p.view_count or 0) + 1
    await db.commit()
    return UpcyclingResponse(
        id=p.id, creator_id=p.creator_id, creator_name=name,
        creator_verified=verified, title=p.title, description=p.description,
        materials_used=p.materials_used or [], before_images=p.before_images or [],
        after_images=p.after_images or [],
        estimated_waste_diverted_kg=p.estimated_waste_diverted_kg,
        difficulty=p.difficulty, time_spent_hours=p.time_spent_hours,
        status=p.status, family=p.family, category=p.category,
        view_count=p.view_count, created_at=p.created_at,
    )


@router.post("/upcycling", response_model=UpcyclingResponse, status_code=201)
async def create_upcycling(
    body: UpcyclingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = UpcyclingProject(
        creator_id=current_user.id,
        title=body.title,
        description=body.description,
        materials_used=body.materials_used,
        before_images=body.before_images,
        after_images=body.after_images,
        estimated_waste_diverted_kg=body.estimated_waste_diverted_kg,
        difficulty=body.difficulty,
        time_spent_hours=body.time_spent_hours,
        status=body.status or "published",
        family=body.family,
        category=body.category,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return UpcyclingResponse(
        id=project.id, creator_id=project.creator_id, creator_name=current_user.name,
        creator_verified=current_user.is_verified, title=project.title,
        description=project.description, materials_used=project.materials_used or [],
        before_images=project.before_images or [], after_images=project.after_images or [],
        estimated_waste_diverted_kg=project.estimated_waste_diverted_kg,
        difficulty=project.difficulty, time_spent_hours=project.time_spent_hours,
        status=project.status, family=project.family, category=project.category,
        view_count=0, created_at=project.created_at,
    )


# ── Waste Challenges ───────────────────────────────────────────────────

@router.get("/challenges", response_model=list[ChallengeResponse])
async def list_challenges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WasteChallenge).where(WasteChallenge.status == "active")
        .order_by(WasteChallenge.created_at.desc())
    )
    challenges = result.scalars().all()
    return [
        ChallengeResponse(
            id=c.id, title=c.title, description=c.description,
            target_kg=c.target_kg, current_kg=c.current_kg,
            start_date=c.start_date, end_date=c.end_date,
            organizer_id=c.organizer_id, status=c.status,
            image_url=c.image_url, created_at=c.created_at,
            progress_pct=min(100, (c.current_kg / c.target_kg * 100) if c.target_kg > 0 else 0),
        )
        for c in challenges
    ]


@router.post("/challenges", response_model=ChallengeResponse, status_code=201)
async def create_challenge(
    body: ChallengeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    challenge = WasteChallenge(
        title=body.title,
        description=body.description,
        target_kg=body.target_kg,
        start_date=body.start_date,
        end_date=body.end_date,
        organizer_id=current_user.id,
        image_url=body.image_url,
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    return ChallengeResponse(
        id=challenge.id, title=challenge.title, description=challenge.description,
        target_kg=challenge.target_kg, current_kg=challenge.current_kg,
        start_date=challenge.start_date, end_date=challenge.end_date,
        organizer_id=challenge.organizer_id, status=challenge.status,
        image_url=challenge.image_url, created_at=challenge.created_at,
        progress_pct=0.0,
    )
