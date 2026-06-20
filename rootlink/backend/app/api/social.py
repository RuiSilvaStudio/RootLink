from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.group import Follow, Group
from app.models.content import Content
from app.models.event import Event, EventRSVP, EventDonation
from app.models.learning import Course
from app.models.comment import Comment
from app.models.marketplace import Listing
from app.models.notification import Notification, NotificationType
from app.schemas.auth import UserResponse
from app.services.sse import sse_manager

router = APIRouter(prefix="/api/social", tags=["social"])


# --- Follow / Unfollow ---

@router.post("/follow/{user_id}", status_code=204)
async def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already following")

    follow = Follow(follower_id=current_user.id, following_id=user_id)
    db.add(follow)

    notif = Notification(
        user_id=user_id,
        actor_id=current_user.id,
        type=NotificationType.follow,
        message=f"{current_user.name} started following you",
        link=f"/profile/{current_user.id}",
    )
    db.add(notif)
    await db.commit()
    await sse_manager.notify(notif.user_id, {"count": 0})


@router.delete("/follow/{user_id}", status_code=204)
async def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    await db.commit()


@router.get("/followers", response_model=list[UserResponse])
async def get_followers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).join(Follow, Follow.follower_id == User.id).where(
            Follow.following_id == current_user.id
        )
    )
    return result.scalars().all()


@router.get("/following", response_model=list[UserResponse])
async def get_following(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).join(Follow, Follow.following_id == User.id).where(
            Follow.follower_id == current_user.id
        )
    )
    return result.scalars().all()


# --- Activity Feed ---

async def _build_feed_item(
    item_type: str,
    action: str,
    actor_id: int | None,
    target_id: int,
    target_title: str,
    target_type: str,
    created_at,
    user_names: dict[int, str],
    link: str | None = None,
) -> dict:
    return {
        "type": item_type,
        "action": action,
        "actor_id": actor_id,
        "actor_name": user_names.get(actor_id, f"User #{actor_id}") if actor_id else "Unknown",
        "target": {"id": target_id, "title": target_title, "type": target_type},
        "link": link,
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
    }


@router.get("/feed")
async def activity_feed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 30,
):
    # Get followed user IDs
    followed_result = await db.execute(
        select(Follow.following_id).where(Follow.follower_id == current_user.id)
    )
    followed_ids = [row[0] for row in followed_result.all()]
    followed_set = set(followed_ids)

    # Collect all actor IDs we need names for
    all_actor_ids: set[int] = set()

    # --- Gather content ---
    content_result = await db.execute(
        select(Content, User.name)
        .join(User, Content.created_by == User.id, isouter=True)
        .where(Content.source == "user")
        .order_by(Content.created_at.desc())
        .limit(limit)
    )
    content_rows = content_result.all()
    content_items = []
    following_items = []
    for c, author_name in content_rows:
        if c.created_by:
            all_actor_ids.add(c.created_by)
        item = {
            "type": "content",
            "action": "published",
            "actor_id": c.created_by,
            "actor_name": author_name or f"User #{c.created_by}",
            "target": {"id": c.id, "title": c.title, "type": "article"},
            "link": f"/content/{c.id}",
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        content_items.append(item)
        if c.created_by in followed_set:
            following_items.append(item)

    # --- Gather events ---
    event_result = await db.execute(
        select(Event, User.name)
        .join(User, Event.created_by == User.id, isouter=True)
        .order_by(Event.created_at.desc())
        .limit(limit)
    )
    event_rows = event_result.all()
    event_items = []
    for e, creator_name in event_rows:
        if e.created_by:
            all_actor_ids.add(e.created_by)
        item = {
            "type": "event",
            "action": "created",
            "actor_id": e.created_by,
            "actor_name": creator_name or f"User #{e.created_by}",
            "target": {"id": e.id, "title": e.title, "type": "event"},
            "link": f"/events/{e.id}",
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        event_items.append(item)
        if e.created_by in followed_set:
            following_items.append(item)

    # --- Gather groups ---
    group_result = await db.execute(
        select(Group, User.name)
        .join(User, Group.created_by == User.id, isouter=True)
        .order_by(Group.created_at.desc())
        .limit(limit)
    )
    group_rows = group_result.all()
    group_items = []
    for g, creator_name in group_rows:
        if g.created_by:
            all_actor_ids.add(g.created_by)
        item = {
            "type": "group",
            "action": "created",
            "actor_id": g.created_by,
            "actor_name": creator_name or f"User #{g.created_by}",
            "target": {"id": g.id, "title": g.name, "type": "group"},
            "link": f"/groups/{g.id}",
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        group_items.append(item)
        if g.created_by in followed_set:
            following_items.append(item)

    # --- Gather courses ---
    course_result = await db.execute(
        select(Course, User.name)
        .join(User, Course.created_by == User.id, isouter=True)
        .where(Course.published.is_(True))
        .order_by(Course.created_at.desc())
        .limit(limit)
    )
    course_rows = course_result.all()
    course_items = []
    for co, creator_name in course_rows:
        if co.created_by:
            all_actor_ids.add(co.created_by)
        item = {
            "type": "course",
            "action": "published",
            "actor_id": co.created_by,
            "actor_name": creator_name or f"User #{co.created_by}",
            "target": {"id": co.id, "title": co.title, "type": "course"},
            "link": f"/learning/courses/{co.id}",
            "created_at": co.created_at.isoformat() if co.created_at else None,
        }
        course_items.append(item)
        if co.created_by in followed_set:
            following_items.append(item)

    # --- Gather marketplace listings ---
    listing_result = await db.execute(
        select(Listing, User.name)
        .join(User, Listing.seller_id == User.id, isouter=True)
        .where(Listing.status == "active")
        .order_by(Listing.created_at.desc())
        .limit(limit)
    )
    listing_items = []
    for lst, seller_name in listing_result.all():
        if lst.seller_id:
            all_actor_ids.add(lst.seller_id)
        price_label = f" — €{(lst.price_cents / 100):.0f}" if lst.price_cents > 0 else ""
        item = {
            "type": "listing",
            "action": "listed",
            "actor_id": lst.seller_id,
            "actor_name": seller_name or f"User #{lst.seller_id}",
            "target": {"id": lst.id, "title": lst.title + price_label, "type": "listing"},
            "link": f"/marketplace/{lst.id}",
            "created_at": lst.created_at.isoformat() if lst.created_at else None,
        }
        listing_items.append(item)
        if lst.seller_id in followed_set:
            following_items.append(item)

    # --- Gather recent comments ---
    comment_result = await db.execute(
        select(Comment, User.name)
        .join(User, Comment.user_id == User.id, isouter=True)
        .order_by(Comment.created_at.desc())
        .limit(limit)
    )
    comment_rows = comment_result.all()
    comment_items = []
    entity_links = {"content": "/content/", "event": "/events/", "group": "/groups/", "plant": "/plants/", "course": "/learning/courses/", "lesson": "/learning/courses/"}
    for cm, commenter_name in comment_rows:
        if cm.user_id:
            all_actor_ids.add(cm.user_id)
        link = entity_links.get(cm.entity_type, "/") + str(cm.entity_id)
        item = {
            "type": "comment",
            "action": "commented on",
            "actor_id": cm.user_id,
            "actor_name": commenter_name or f"User #{cm.user_id}",
            "target": {"id": cm.entity_id, "title": f"{cm.entity_type} #{cm.entity_id}", "type": cm.entity_type},
            "link": link,
            "created_at": cm.created_at.isoformat() if cm.created_at else None,
            "body_preview": cm.body[:80] + "..." if len(cm.body) > 80 else cm.body,
        }
        comment_items.append(item)
        if cm.user_id in followed_set:
            following_items.append(item)

    # --- Gather recent RSVPs ---
    rsvp_result = await db.execute(
        select(EventRSVP, User.name, Event.title)
        .join(User, EventRSVP.user_id == User.id, isouter=True)
        .join(Event, EventRSVP.event_id == Event.id, isouter=True)
        .order_by(EventRSVP.created_at.desc())
        .limit(limit)
    )
    rsvp_rows = rsvp_result.all()
    rsvp_items = []
    for r, user_name, event_title in rsvp_rows:
        if r.user_id:
            all_actor_ids.add(r.user_id)
        item = {
            "type": "rsvp",
            "action": "RSVPed to",
            "actor_id": r.user_id,
            "actor_name": user_name or f"User #{r.user_id}",
            "target": {"id": r.event_id, "title": event_title or f"Event #{r.event_id}", "type": "event"},
            "link": f"/events/{r.event_id}",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        rsvp_items.append(item)
        if r.user_id in followed_set:
            following_items.append(item)

    # --- Gather recent donations ---
    donation_result = await db.execute(
        select(EventDonation, Event.title)
        .join(Event, EventDonation.event_id == Event.id, isouter=True)
        .where(EventDonation.is_anonymous.is_(False))
        .order_by(EventDonation.created_at.desc())
        .limit(limit)
    )
    donation_rows = donation_result.all()
    donation_items = []
    for d, event_title in donation_rows:
        if d.user_id:
            all_actor_ids.add(d.user_id)
        # Get donor name
        donor_name = "Anonymous"
        if d.donor_name and not d.is_anonymous:
            donor_name = d.donor_name
        item = {
            "type": "donation",
            "action": "donated to",
            "actor_id": d.user_id,
            "actor_name": donor_name,
            "target": {"id": d.event_id, "title": event_title or f"Event #{d.event_id}", "type": "event"},
            "link": f"/events/{d.event_id}",
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "amount": d.amount,
        }
        donation_items.append(item)
        if d.user_id in followed_set:
            following_items.append(item)

    # Build discover feed: merge all and sort by date
    discover = content_items + event_items + group_items + course_items + listing_items + comment_items + rsvp_items + donation_items
    discover.sort(key=lambda x: x["created_at"] or "", reverse=True)
    discover = discover[:limit]

    # Deduplicate and sort following items
    seen = set()
    following_unique = []
    for item in following_items:
        key = (item["type"], item["target"]["id"], item["actor_id"])
        if key not in seen:
            seen.add(key)
            following_unique.append(item)
    following_unique.sort(key=lambda x: x["created_at"] or "", reverse=True)
    following_unique = following_unique[:limit]

    # Enrich all feed items with account_type and is_verified
    all_actor_ids = {item["actor_id"] for item in discover + following_unique if item.get("actor_id")}
    if all_actor_ids:
        user_info_result = await db.execute(
            select(User.id, User.account_type, User.is_verified).where(User.id.in_(all_actor_ids))
        )
        user_info = {r[0]: {"account_type": r[1], "is_verified": r[2]} for r in user_info_result.all()}
        for item in discover + following_unique:
            info = user_info.get(item.get("actor_id"))
            if info:
                item["account_type"] = info["account_type"]
                item["is_verified"] = info["is_verified"]
            else:
                item["account_type"] = "individual"
                item["is_verified"] = False

    return {
        "following": following_unique,
        "discover": discover,
    }
