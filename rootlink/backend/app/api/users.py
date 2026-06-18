from math import radians, sin, cos, sqrt, atan2

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query("", min_length=1),
    skill: str | None = None,
    interest: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.visible_in_network == True)
    if q:
        like = f"%{q}%"
        query = query.where(
            or_(
                User.name.ilike(like),
                User.bio.ilike(like),
                User.location.ilike(like),
            )
        )
    if skill:
        query = query.where(User.skills.any(skill))
    if interest:
        query = query.where(User.interests.any(interest))
    query = query.order_by(User.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/match", response_model=list[UserResponse])
async def match_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    my_skills = set(current_user.skills or [])
    my_interests = set(current_user.interests or [])
    all_tags = my_skills | my_interests

    if not all_tags:
        return []

    result = await db.execute(select(User).where(User.id != current_user.id, User.visible_in_network == True))
    users = result.scalars().all()

    def score(user: User) -> int:
        s = 0
        if user.skills:
            s += len(set(user.skills) & all_tags) * 2
        if user.interests:
            s += len(set(user.interests) & all_tags)
        return s

    scored = [(user, score(user)) for user in users if score(user) > 0]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [u for u, _ in scored[:20]]


@router.get("/nearby", response_model=list[UserResponse])
async def nearby_users(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(50),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.lat.isnot(None), User.lng.isnot(None), User.visible_in_network == True))
    users = result.scalars().all()

    def haversine(lat1, lon1, lat2, lon2):
        R = 6371
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))

    nearby = [u for u in users if u.lat and u.lng and haversine(lat, lng, u.lat, u.lng) <= radius_km]
    return nearby


@router.get("/stats/regions")
async def user_regions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User.location).where(User.visible_in_network == True, User.location.isnot(None)))
    locations = [row[0] for row in result.all()]
    regions: dict[str, int] = {}
    for loc in locations:
        parts = [p.strip() for p in loc.split(",")]
        region = parts[0] if parts else loc
        regions[region] = regions.get(region, 0) + 1
    sorted_regions = sorted(regions.items(), key=lambda x: x[1], reverse=True)
    return [{"region": r, "count": c} for r, c in sorted_regions]


@router.get("/stats/skills")
async def user_skills(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User.skills).where(User.visible_in_network == True, User.skills.isnot(None)))
    skill_counts: dict[str, int] = {}
    for row in result.all():
        skills = row[0] or []
        for skill in skills:
            skill = skill.strip().lower()
            if skill:
                skill_counts[skill] = skill_counts.get(skill, 0) + 1
    sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"skill": s, "count": c} for s, c in sorted_skills]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
