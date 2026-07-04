from math import atan2, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.comment import Comment
from app.models.content import Bookmark, Content
from app.models.event import Event, EventDonation, EventRSVP, EventTicket
from app.models.group import Follow, Group, GroupMember
from app.models.learning import Course, Enrollment
from app.models.notification import Notification
from app.models.user import User
from app.schemas.auth import UserResponse
from app.services.content_visibility import public_content_clause

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/entities")
async def search_entities(
    q: str | None = Query(None),
    account_type: str | None = Query(None),
    entity_type: str | None = Query(None),
    family: str | None = Query(None),
    region: str | None = Query(None),
    verified_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Search organizations and practitioners with entity-specific filters."""
    query = select(User).where(User.account_type != "individual", User.visible_in_network.is_(True))

    if q:
        like = f"%{q}%"
        query = query.where(
            or_(
                User.name.ilike(like),
                User.bio.ilike(like),
                User.location.ilike(like),
                User.service_area.ilike(like),
                User.modality.ilike(like),
            )
        )
    if account_type:
        query = query.where(User.account_type == account_type)
    if entity_type:
        # `entity_type` stays the external query-param/field name; internally
        # this reads the renamed `organization_kind` column (Phase 0(f)).
        query = query.where(User.organization_kind == entity_type)
    if family:
        query = query.where(or_(User.interests.any(family), User.skills.any(family)))
    if region:
        query = query.where(or_(User.service_area.ilike(f"%{region}%"), User.location.ilike(f"%{region}%")))
    if verified_only:
        query = query.where(User.is_verified.is_(True))

    query = query.order_by(User.is_verified.desc(), User.name.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    entities = []
    for u in users:
        content_count = await db.scalar(select(func.count(Content.id)).where(Content.created_by == u.id)) or 0
        event_count = await db.scalar(select(func.count(Event.id)).where(Event.created_by == u.id)) or 0
        group_count = await db.scalar(select(func.count(Group.id)).where(Group.created_by == u.id)) or 0
        entities.append({
            "id": u.id,
            "name": u.name,
            "account_type": u.account_type,
            "entity_type": u.entity_type,
            "bio": u.bio,
            "location": u.location,
            "service_area": u.service_area,
            "avatar_url": u.avatar_url,
            "is_verified": u.is_verified,
            "services": u.services,
            "modality": u.modality,
            "content_count": content_count,
            "event_count": event_count,
            "group_count": group_count,
        })
    return entities


@router.get("/entities/stats")
async def entity_stats(db: AsyncSession = Depends(get_db)):
    """Stats for entity directory sidebar."""
    total_orgs = await db.scalar(
        select(func.count(User.id)).where(User.account_type == "organization", User.visible_in_network.is_(True))
    ) or 0
    total_practitioners = await db.scalar(
        select(func.count(User.id)).where(User.account_type == "practitioner", User.visible_in_network.is_(True))
    ) or 0
    verified = await db.scalar(
        select(func.count(User.id)).where(User.account_type != "individual", User.is_verified.is_(True), User.visible_in_network.is_(True))
    ) or 0

    # By entity type (organization sub-kind; external field name stays
    # "entity_type" — see Phase 0(f) rename note above)
    et_result = await db.execute(
        select(User.organization_kind, func.count(User.id))
        .where(User.account_type == "organization", User.visible_in_network.is_(True), User.organization_kind.isnot(None))
        .group_by(User.organization_kind)
    )
    by_entity_type = [{"type": t, "count": c} for t, c in et_result.all() if t]

    # By region
    region_result = await db.execute(
        select(User.service_area, func.count(User.id))
        .where(User.account_type != "individual", User.visible_in_network.is_(True), User.service_area.isnot(None))
        .group_by(User.service_area)
    )
    by_region = [{"region": r, "count": c} for r, c in region_result.all() if r]

    return {
        "organizations": total_orgs,
        "practitioners": total_practitioners,
        "verified": verified,
        "by_entity_type": by_entity_type,
        "by_region": by_region,
    }


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query("", min_length=1),
    skill: str | None = None,
    interest: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.visible_in_network.is_(True))
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

    result = await db.execute(select(User).where(User.id != current_user.id, User.visible_in_network.is_(True)))
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
    result = await db.execute(select(User).where(User.lat.isnot(None), User.lng.isnot(None), User.visible_in_network.is_(True)))
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
    result = await db.execute(select(User.location).where(User.visible_in_network.is_(True), User.location.isnot(None)))
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
    result = await db.execute(select(User.skills).where(User.visible_in_network.is_(True), User.skills.isnot(None)))
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
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Hide email for other users' profiles
    if not (current_user and current_user.id == user_id):
        user_dict = user.__dict__.copy()
        user_dict["email"] = ""
        return UserResponse(**user_dict)
    return user


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: int,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns user activity. Private data (tickets, bookmarks, donations) only for own profile."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_own = current_user is not None and current_user.id == user_id

    # --- Stats ---
    stats = {}
    stats["content"] = await db.scalar(
        select(func.count(Content.id)).where(Content.created_by == user_id, public_content_clause())
    ) or 0
    stats["events"] = await db.scalar(select(func.count(Event.id)).where(Event.created_by == user_id)) or 0
    stats["groups"] = await db.scalar(select(func.count(Group.id)).where(Group.created_by == user_id)) or 0
    stats["courses"] = await db.scalar(select(func.count(Course.id)).where(Course.created_by == user_id)) or 0
    stats["comments"] = await db.scalar(select(func.count(Comment.id)).where(Comment.user_id == user_id)) or 0
    stats["rsvps"] = await db.scalar(select(func.count(EventRSVP.id)).where(EventRSVP.user_id == user_id)) or 0
    stats["groups_joined"] = await db.scalar(select(func.count(GroupMember.id)).where(GroupMember.user_id == user_id)) or 0
    stats["followers"] = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.type == "follow", Notification.user_id == user_id
        )
    ) or 0

    if is_own:
        stats["tickets"] = await db.scalar(select(func.count(EventTicket.id)).where(EventTicket.user_id == user_id)) or 0
        stats["donations"] = await db.scalar(select(func.count(EventDonation.id)).where(EventDonation.user_id == user_id)) or 0
        stats["bookmarks"] = await db.scalar(select(func.count(Bookmark.id)).where(Bookmark.user_id == user_id)) or 0
        stats["enrollments"] = await db.scalar(select(func.count(Enrollment.id)).where(Enrollment.user_id == user_id)) or 0

    # --- Content published (only live/approved content is shown publicly) ---
    content_result = await db.execute(
        select(Content).where(
            Content.created_by == user_id,
            Content.source == "user",
            public_content_clause(),
        )
        .order_by(Content.created_at.desc()).limit(12)
    )
    content_list = [{
        "id": c.id, "title": c.title, "category": c.category, "family": c.family,
        "image_url": c.image_url, "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in content_result.scalars().all()]

    # --- Events created ---
    event_result = await db.execute(
        select(Event).where(Event.created_by == user_id)
        .order_by(Event.date.desc()).limit(12)
    )
    event_list = [{
        "id": e.id, "title": e.title, "date": e.date.isoformat() if e.date else None,
        "location": e.location, "image_url": e.image_url,
    } for e in event_result.scalars().all()]

    # --- Groups created ---
    group_result = await db.execute(
        select(Group).where(Group.created_by == user_id)
        .order_by(Group.created_at.desc()).limit(12)
    )
    group_list = [{
        "id": g.id, "name": g.name, "slug": g.slug, "category": g.category,
        "family": g.family, "image_url": g.image_url,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    } for g in group_result.scalars().all()]

    # --- Courses created ---
    course_result = await db.execute(
        select(Course).where(Course.created_by == user_id)
        .order_by(Course.created_at.desc()).limit(12)
    )
    course_list = [{
        "id": co.id, "title": co.title, "published": co.published,
        "image_url": co.image_url, "category": co.category, "family": co.family,
    } for co in course_result.scalars().all()]

    # --- Comments ---
    comment_result = await db.execute(
        select(Comment).where(Comment.user_id == user_id)
        .order_by(Comment.created_at.desc()).limit(20)
    )
    comment_list = [{
        "id": cm.id, "entity_type": cm.entity_type, "entity_id": cm.entity_id,
        "body": cm.body[:120], "created_at": cm.created_at.isoformat() if cm.created_at else None,
    } for cm in comment_result.scalars().all()]

    # --- Groups joined (public) ---
    joined_result = await db.execute(
        select(Group, GroupMember.role)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user_id)
        .order_by(GroupMember.created_at.desc())
    )
    groups_joined = [{
        "id": g.id, "name": g.name, "slug": g.slug, "role": role,
        "image_url": g.image_url, "category": g.category, "family": g.family,
    } for g, role in joined_result.all()]

    # --- Followers/following (public) ---
    followers_result = await db.execute(
        select(User.id, User.name, User.avatar_url)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.following_id == user_id)
        .limit(50)
    )
    followers = [{"id": r[0], "name": r[1], "avatar_url": r[2]} for r in followers_result.all()]

    following_result = await db.execute(
        select(User.id, User.name, User.avatar_url)
        .join(Follow, Follow.following_id == User.id)
        .where(Follow.follower_id == user_id)
        .limit(50)
    )
    following = [{"id": r[0], "name": r[1], "avatar_url": r[2]} for r in following_result.all()]

    # --- Private data (own profile only) ---
    rsvps = []
    tickets = []
    donations = []
    bookmarks = []
    enrollments = []

    if is_own:
        # RSVPs
        rsvp_result = await db.execute(
            select(EventRSVP, Event.title, Event.date, Event.location)
            .join(Event, EventRSVP.event_id == Event.id)
            .where(EventRSVP.user_id == user_id)
            .order_by(EventRSVP.created_at.desc())
        )
        rsvps = [{
            "event_id": r[0].event_id, "event_title": r[1],
            "event_date": r[2].isoformat() if r[2] else None, "event_location": r[3],
        } for r in rsvp_result.all()]

        # Tickets
        ticket_result = await db.execute(
            select(EventTicket, Event.title, Event.date)
            .join(Event, EventTicket.event_id == Event.id)
            .where(EventTicket.user_id == user_id)
            .order_by(EventTicket.created_at.desc())
        )
        tickets = [{
            "id": t[0].id, "event_id": t[0].event_id, "event_title": t[1],
            "event_date": t[2].isoformat() if t[2] else None,
            "ticket_type": t[0].ticket_type, "quantity": t[0].quantity,
            "total_paid": t[0].total_paid, "checked_in": t[0].checked_in,
        } for t in ticket_result.all()]

        # Donations
        donation_result = await db.execute(
            select(EventDonation, Event.title)
            .join(Event, EventDonation.event_id == Event.id)
            .where(EventDonation.user_id == user_id)
            .order_by(EventDonation.created_at.desc())
        )
        donations = [{
            "id": d[0].id, "event_id": d[0].event_id, "event_title": d[1],
            "amount": d[0].amount, "is_anonymous": d[0].is_anonymous,
            "created_at": d[0].created_at.isoformat() if d[0].created_at else None,
        } for d in donation_result.all()]

        # Bookmarks
        bookmark_result = await db.execute(
            select(Bookmark, Content.title)
            .join(Content, Bookmark.content_id == Content.id, isouter=True)
            .where(Bookmark.user_id == user_id)
            .order_by(Bookmark.created_at.desc())
        )
        bookmarks = [{
            "id": b[0].id, "content_id": b[0].content_id, "content_title": b[1] or f"Content #{b[0].content_id}",
        } for b in bookmark_result.all()]

        # Enrollments
        enroll_result = await db.execute(
            select(Enrollment, Course.title, Course.image_url)
            .join(Course, Enrollment.course_id == Course.id, isouter=True)
            .where(Enrollment.user_id == user_id)
            .order_by(Enrollment.created_at.desc())
        )
        enrollments = [{
            "course_id": e[0].course_id, "course_title": e[1], "course_image": e[2],
        } for e in enroll_result.all()]
    else:
        # Public donations (non-anonymous only)
        donation_result = await db.execute(
            select(EventDonation, Event.title)
            .join(Event, EventDonation.event_id == Event.id)
            .where(EventDonation.user_id == user_id, EventDonation.is_anonymous.is_(False))
            .order_by(EventDonation.created_at.desc())
            .limit(10)
        )
        donations = [{
            "id": d[0].id, "event_id": d[0].event_id, "event_title": d[1],
            "amount": d[0].amount, "is_anonymous": False,
            "created_at": d[0].created_at.isoformat() if d[0].created_at else None,
        } for d in donation_result.all()]

        # Public RSVPs (for public events)
        rsvp_result = await db.execute(
            select(EventRSVP, Event.title, Event.date)
            .join(Event, EventRSVP.event_id == Event.id)
            .where(EventRSVP.user_id == user_id, Event.visibility == "all")
            .order_by(EventRSVP.created_at.desc())
            .limit(10)
        )
        rsvps = [{
            "event_id": r[0].event_id, "event_title": r[1],
            "event_date": r[2].isoformat() if r[2] else None,
        } for r in rsvp_result.all()]

    return {
        "stats": stats,
        "content": content_list,
        "events": event_list,
        "groups": group_list,
        "courses": course_list,
        "comments": comment_list,
        "groups_joined": groups_joined,
        "followers": followers,
        "following": following,
        "rsvps": rsvps,
        "tickets": tickets,
        "donations": donations,
        "bookmarks": bookmarks,
        "enrollments": enrollments,
        "is_own": is_own,
        "member_since": user.created_at.isoformat() if user.created_at else None,
    }
