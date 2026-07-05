from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.entity_resolution import ROLE_RANK
from app.core.permissions import can, rank_at_least
from app.core.security import get_current_user, hash_password
from app.models.comment import Comment
from app.models.content import Content, ContentStatus, SearchQueryLog, VerificationStatus
from app.models.event import Event, EventDonation, EventRSVP, EventSponsor, EventTicket, EventVendor
from app.models.group import Group, GroupMember, GroupStatus
from app.models.learning import Course, Enrollment
from app.models.moderation import ModerationAction
from app.models.notification import Notification, NotificationType
from app.models.setting import Setting
from app.models.user import AccountStatus, User, UserRole
from app.schemas.comment import CommentResponse
from app.schemas.content import ContentResponse
from app.schemas.event import SponsorUpdate, VendorUpdate
from app.schemas.group import GroupResponse
from app.schemas.moderation import BanRequest, RestrictRequest, SelfPublishGrant, SuspendRequest
from app.schemas.setting import SettingResponse, SettingUpdate
from app.services.audit import log_moderation
from app.services.trust import self_publish_eligibility

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_role(allowed_roles: list[UserRole]):
    """Every call site here passes a contiguous "this role and everything
    above it" list (e.g. `[admin, moderator]`, never a gap like
    `[moderator]` alone without `admin`) — so the gate is really "resolved
    rank >= the lowest rank named," which is exactly `rank_at_least`
    (Phase 3 cutover, TECH_DEBT.md §0). This was already correct before
    this change (`super_admin` checked first, unconditionally) — migrated
    onto the shared helper for consistency with the other 23 sites, not
    because it was broken.
    """
    floor = min(ROLE_RANK[r.value] for r in allowed_roles)

    def _require_role(current_user: User = Depends(get_current_user)):
        if not rank_at_least(current_user, floor):
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return _require_role


require_super_admin = Depends(require_role([UserRole.super_admin]))
require_admin = Depends(require_role([UserRole.admin]))
require_mod = Depends(require_role([UserRole.admin, UserRole.moderator]))
require_contributor = Depends(require_role([UserRole.admin, UserRole.moderator, UserRole.contributor]))


@router.get("/dashboard")
async def dashboard(
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    users_count = await db.scalar(select(func.count(User.id)))
    content_count = await db.scalar(select(func.count(Content.id)))
    groups_count = await db.scalar(select(func.count(Group.id)))
    comments_count = await db.scalar(select(func.count(Comment.id)))
    events_count = await db.scalar(select(func.count(Event.id)))
    courses_count = await db.scalar(select(func.count(Course.id)))
    enrollments_count = await db.scalar(select(func.count(Enrollment.id)))
    unreviewed = await db.scalar(
        select(func.count(Content.id)).where(Content.verification_status == VerificationStatus.unreviewed)
    )
    cross_ref = await db.scalar(
        select(func.count(Content.id)).where(Content.verification_status == VerificationStatus.cross_referenced)
    )

    return {
        "users": users_count or 0,
        "content": content_count or 0,
        "groups": groups_count or 0,
        "comments": comments_count or 0,
        "events": events_count or 0,
        "courses": courses_count or 0,
        "enrollments": enrollments_count or 0,
        "unreviewed_content": unreviewed or 0,
        "cross_referenced_content": cross_ref or 0,
    }


# ── Users ──

@router.get("/users")
async def list_users(
    q: str | None = Query(None),
    role: str | None = Query(None),
    account_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        stmt = stmt.where(
            User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        )
    if role:
        stmt = stmt.where(User.role == role)
    if account_type:
        stmt = stmt.where(User.account_type == account_type)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: UserRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    await db.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/password")
async def reset_user_password(
    user_id: int,
    password: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(password)
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/verify")
async def verify_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.account_type == "individual":
        raise HTTPException(status_code=400, detail="Only organizations and practitioners can be verified")
    user.is_verified = True
    user.verified_at = datetime.now(UTC)
    await db.commit()
    return {"ok": True, "is_verified": True}


@router.post("/users/{user_id}/unverify")
async def unverify_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = False
    user.verified_at = None
    await db.commit()
    return {"ok": True, "is_verified": False}


# ── Trust (CONTENT_PLATFORM.md §3, still the live self-publish mechanism —
# see models/user.py's field comment) & enforcement ladder (originally
# CONTENT_PLATFORM.md §4.4; the ladder itself — including this file's
# restrict/lift-restriction endpoints below — is now specified by
# docs/roles-permissions/ROLES_PERMISSIONS.md §4) ──

@router.get("/users/{user_id}/self-publish/eligibility")
async def user_self_publish_eligibility(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await self_publish_eligibility(db, user)


@router.patch("/users/{user_id}/self-publish")
async def set_self_publish(
    user_id: int,
    body: SelfPublishGrant,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    """Grant/revoke trusted-author self-publishing. Granting requires the user to be
    eligible and to have accepted the agreement (super_admin may override)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.grant:
        elig = await self_publish_eligibility(db, user)
        is_super = current_user.role == UserRole.super_admin
        if not is_super and not elig["eligible"]:
            raise HTTPException(status_code=400, detail="User is not eligible for self-publishing")
        if not is_super and not elig["agreed"]:
            raise HTTPException(status_code=400, detail="User has not accepted the publisher responsibility agreement")
        user.can_self_publish = True
        action = ModerationAction.grant_self_publish
    else:
        user.can_self_publish = False
        action = ModerationAction.revoke_self_publish
    await log_moderation(db, action=action, target_type="user", target_id=user_id, actor_id=current_user.id)
    await db.commit()
    return {"ok": True, "can_self_publish": user.can_self_publish}


@router.post("/users/{user_id}/restrict")
async def restrict_user(
    user_id: int,
    body: RestrictRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    """Phase 4 restriction rung (docs/roles-permissions/ROLES_PERMISSIONS.md §4): full read/write access is
    retained (unlike suspend/ban) — only future authoring trust is affected.
    See `User.is_restricted` / `app/api/articles.py`'s trust checks for the
    enforcement half of this."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot restrict yourself")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = AccountStatus.restricted
    await log_moderation(
        db, action=ModerationAction.restrict, target_type="user", target_id=user_id,
        actor_id=current_user.id, reason=body.reason,
    )
    await db.commit()
    return {"ok": True, "account_status": "restricted"}


@router.post("/users/{user_id}/lift-restriction")
async def lift_restriction(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.account_status != AccountStatus.restricted:
        raise HTTPException(status_code=400, detail="User is not currently restricted")
    user.account_status = AccountStatus.active
    await log_moderation(
        db, action=ModerationAction.lift_restriction, target_type="user",
        target_id=user_id, actor_id=current_user.id,
    )
    await db.commit()
    return {"ok": True, "account_status": "active"}


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    body: SuspendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = AccountStatus.suspended
    user.suspended_until = body.until
    await log_moderation(
        db, action=ModerationAction.suspend, target_type="user", target_id=user_id,
        actor_id=current_user.id, reason=body.reason, meta={"until": body.until.isoformat()},
    )
    await db.commit()
    return {"ok": True, "account_status": "suspended", "suspended_until": user.suspended_until}


@router.post("/users/{user_id}/lift-suspension")
async def lift_suspension(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = AccountStatus.active
    user.suspended_until = None
    await log_moderation(
        db, action=ModerationAction.lift_suspension, target_type="user",
        target_id=user_id, actor_id=current_user.id,
    )
    await db.commit()
    return {"ok": True, "account_status": "active"}


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: int,
    body: BanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    """Permanent ban: blocks access, unpublishes the user's live content, AND
    anonymizes (tombstones) their authorship on it — docs/roles-permissions/ROLES_PERMISSIONS.md §4 / GDPR
    Art. 17 (Phase 4; previously this endpoint only unpublished, leaving
    anonymization entirely to the separate self-service erasure path in
    `app/api/account.py` — but a ban is platform-triggered, not user-
    triggered, so it needs its own anonymization step, not a dependency on
    the banned user separately requesting erasure). `created_by -> NULL` is
    the same tombstone mechanism `account.delete_my_account` already uses,
    reused here for consistency — it is deliberately NOT restored on unban
    (anonymization is a one-way GDPR erasure action; reversing the ban only
    restores account access, never the anonymized authorship — see
    docs/roles-permissions/ROLES_PERMISSIONS.md §4's "Appeal-only to reverse" note, which is about the ban
    decision, not about un-anonymizing content). A moderator/admin may still
    choose to re-publish a high-value item afterwards — it stays
    anonymized (author shown as a tombstone), never re-attributed."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = AccountStatus.banned
    user.banned_at = datetime.now(UTC)
    user.ban_reason = body.reason
    user.banned_by = current_user.id
    await db.execute(
        update(Content)
        .where(Content.created_by == user_id, Content.status == ContentStatus.published)
        .values(status=ContentStatus.archived, created_by=None)
    )
    await log_moderation(
        db, action=ModerationAction.ban, target_type="user", target_id=user_id,
        actor_id=current_user.id, reason=body.reason,
    )
    await db.commit()
    return {"ok": True, "account_status": "banned"}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = AccountStatus.active
    user.banned_at = None
    user.ban_reason = None
    user.banned_by = None
    await log_moderation(
        db, action=ModerationAction.unban, target_type="user",
        target_id=user_id, actor_id=current_user.id,
    )
    await db.commit()
    return {"ok": True, "account_status": "active"}


# ── Content ──

@router.get("/content", response_model=list[ContentResponse])
async def list_content(
    q: str | None = Query(None),
    verification_status: str | None = Query(None),
    content_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = select(Content).order_by(Content.created_at.desc())
    if q:
        stmt = stmt.where(Content.title.ilike(f"%{q}%"))
    if verification_status:
        stmt = stmt.where(Content.verification_status == verification_status)
    if content_type:
        stmt = stmt.where(Content.content_type == content_type)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/content/{content_id}/review")
async def review_content(
    content_id: int,
    comment: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = require_contributor,
):
    """First pass of the real two-step review/approve flow (docs/roles-permissions/
    ROLES_PERMISSIONS.md §7: "Review article", contributor+). Marks the
    submission `reviewed` — an optional waypoint a moderator can still skip
    (approve works directly from `in_review` too, by product decision).
    `comment` is an internal-only note for whoever approves next, never
    shown to the article's author (see `review_note` for that)."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    if content.status != ContentStatus.in_review:
        raise HTTPException(status_code=400, detail="Only in_review content can be marked reviewed")
    content.status = ContentStatus.reviewed
    if comment:
        content.review_comment = comment
    await log_moderation(
        db,
        action=ModerationAction.review,
        target_type="content",
        target_id=content.id,
        actor_id=current_user.id,
    )
    await db.commit()
    return {"ok": True, "status": "reviewed"}


@router.patch("/content/{content_id}/approve")
async def approve_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_mod,
):
    """Approve requires moderator+ (docs/roles-permissions/ROLES_PERMISSIONS.md
    §7 "Approve article") — previously this was reachable at contributor+,
    a documented Phase 3 enforcement mismatch (ACTION_UI_MAP.md). Fixed here
    as part of building the real two-step review/approve design: a
    contributor-level "review" step is meaningless if any contributor can
    also approve directly, bypassing the moderator floor entirely."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    if content.status not in (ContentStatus.in_review, ContentStatus.reviewed):
        raise HTTPException(status_code=400, detail="Only in_review or reviewed content can be approved")
    # Separation of duties (docs/roles-permissions/ROLES_PERMISSIONS.md §6):
    # nobody — not even an entity's own super admin — may approve their own
    # submission. Approval must always come from a different person.
    if content.created_by is not None and content.created_by == current_user.id:
        raise HTTPException(status_code=403, detail="You cannot approve your own submission")
    # Approve = go live (status is the visibility gate) AND earn the
    # community-reviewed quality badge (CONTENT_PLATFORM.md §2.3).
    content.status = ContentStatus.published
    content.verification_status = VerificationStatus.community_reviewed
    content.validated_by = current_user.id
    if content.published_at is None:
        content.published_at = datetime.now(UTC)
    await log_moderation(
        db,
        action=ModerationAction.approve,
        target_type="content",
        target_id=content.id,
        actor_id=current_user.id,
    )
    await db.commit()
    return {"ok": True, "status": "published", "verification_status": "community_reviewed"}


@router.patch("/content/{content_id}/reject")
async def reject_content(
    content_id: int,
    reason: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = require_mod,
):
    """Soft reject: never hard-deletes (CONTENT_PLATFORM.md §2.5). Records a reason
    and leaves the content appealable by its author. For an already-*approved*
    article, use `revert_approval` instead — that goes back to `in_review`,
    not `rejected` (this endpoint is for denying a submission that was never
    approved in the first place)."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    content.status = ContentStatus.rejected
    content.review_note = reason
    await log_moderation(
        db,
        action=ModerationAction.reject,
        target_type="content",
        target_id=content.id,
        actor_id=current_user.id,
        reason=reason,
    )
    await db.commit()
    return {"ok": True, "status": "rejected"}


@router.patch("/content/{content_id}/revert-approval")
async def revert_approval(
    content_id: int,
    reason: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = require_mod,
):
    """Undo an already-approved article (docs/roles-permissions/ROLES_PERMISSIONS.md
    §7 "Revert article approval", moderator+). Goes back to `in_review` for a
    fresh pass through the two-step flow — deliberately NOT `rejected`
    (that status is reserved for denying a submission that was never
    approved; conflating the two would make the reject/appeal flow also
    fire for a plain "undo," which isn't what happened here)."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    if content.status != ContentStatus.published:
        raise HTTPException(status_code=400, detail="Only published content can have its approval reverted")
    content.status = ContentStatus.in_review
    content.verification_status = VerificationStatus.unreviewed
    if reason:
        content.review_note = reason
    await log_moderation(
        db,
        action=ModerationAction.revert_approval,
        target_type="content",
        target_id=content.id,
        actor_id=current_user.id,
        reason=reason,
    )
    await db.commit()
    return {"ok": True, "status": "in_review"}


@router.get("/review-queue", response_model=list[ContentResponse])
async def review_queue(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_contributor,
):
    stmt = (
        select(Content)
        .where(Content.status.in_([ContentStatus.in_review, ContentStatus.reviewed]))
        .order_by(Content.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/trending-searches")
async def trending_searches(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(
        select(SearchQueryLog.query, func.count(SearchQueryLog.id).label("cnt"))
        .group_by(SearchQueryLog.query)
        .order_by(func.count(SearchQueryLog.id).desc())
        .limit(limit)
    )
    return [{"query": row[0], "count": row[1]} for row in result.all()]


@router.patch("/content/{content_id}/image")
async def update_content_image(
    content_id: int,
    image_url: str,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    content.image_url = image_url
    await db.commit()
    return {"ok": True}


@router.delete("/content/{content_id}", status_code=204)
async def delete_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    await db.execute(delete(Content).where(Content.id == content_id))
    await db.commit()


@router.patch("/content/{content_id}")
async def update_content(
    content_id: int,
    title: str | None = None,
    summary: str | None = None,
    category: str | None = None,
    content_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    if title is not None:
        content.title = title
    if summary is not None:
        content.summary = summary
    if category is not None:
        content.category = category
    if content_type is not None:
        content.content_type = content_type
    await db.commit()
    return content


# ── Groups ──

@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = select(Group).order_by(Group.created_at.desc())
    if q:
        stmt = stmt.where(Group.name.ilike(f"%{q}%"))
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/groups/{group_id}/archive")
async def archive_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-archive a group (PLATFORM super_admin only — docs/roles-permissions/
    ROLES_PERMISSIONS.md §8: an entity's own super admin never qualifies, since a
    group can have members from multiple entities). Members are notified; the
    group is hidden from public surfaces but NOT hard-deleted (data + activity
    preserved).

    Gate changed from the rank-only `require_super_admin` to the registry check
    (2026-07-04, UI backlog batch 3): the rank-only check wrongly passed an
    organization's own rank-5 super admin — same latent gap event.archive's new
    endpoint avoided from day one."""
    if not can(current_user, "group.archive"):
        raise HTTPException(status_code=403, detail="Only a platform super admin can archive a group")
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.status == GroupStatus.archived:
        return {"ok": True, "status": "archived"}

    group.status = GroupStatus.archived
    group.archived_at = datetime.now(UTC)

    # Notify every member that the group is being retired.
    members = (await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))).scalars().all()
    for m in members:
        db.add(Notification(
            user_id=m.user_id,
            actor_id=current_user.id,
            type=NotificationType.system,
            message=f'The group "{group.name}" is being retired and will be archived. Please save anything you need.',
            link=f"/groups/{group_id}",
        ))

    await log_moderation(
        db, action="archive_group", target_type="group", target_id=group_id,
        actor_id=current_user.id, meta={"member_count": len(members)},
    )
    await db.commit()
    return {"ok": True, "status": "archived", "notified": len(members)}


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_super_admin,
):
    """Permanent hard-delete (super_admin only). Prefer /archive; this is irreversible."""
    await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))
    await db.execute(delete(Group).where(Group.id == group_id))
    await db.commit()


# ── Events ──

@router.get("/events")
async def list_events_admin(
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    """Staff listing — unlike the public /api/events list, this INCLUDES archived
    events (that's the whole point: the archive panel needs to show them)."""
    stmt = (
        select(Event, User.name)
        .join(User, Event.created_by == User.id, isouter=True)
        .order_by(Event.created_at.desc())
    )
    if q:
        stmt = stmt.where(Event.title.ilike(f"%{q}%"))
    stmt = stmt.offset(offset).limit(limit)
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": e.id,
            "title": e.title,
            "date": e.date,
            "location": e.location,
            "is_online": e.is_online,
            "image_url": e.image_url,
            "category": e.category,
            "family": e.family,
            "status": e.status,
            "archived_at": e.archived_at,
            "created_by": e.created_by,
            "creator_name": creator_name,
        }
        for e, creator_name in rows
    ]


@router.post("/events/{event_id}/archive")
async def archive_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-archive an event — PLATFORM super_admin only
    (docs/roles-permissions/ROLES_PERMISSIONS.md §8 "Archive event").
    Deliberately NOT the event's owner or an entity's own super admin: an event
    can have attendees from multiple entities, so taking it down needs
    platform-level judgment (same blast-radius reasoning as group.archive).
    Attendees are notified; the event is hidden from public surfaces but NOT
    hard-deleted (data + RSVPs preserved).

    Gate: `can(user, "event.archive")` (registry entity_scope="platform", the
    compost-hub-archive precedent) rather than the group archive's bare
    `require_super_admin` rank check — the rank-only check would wrongly let an
    organization's own super admin (rank 5, entity_kind="organization") through.
    """
    if not can(current_user, "event.archive"):
        raise HTTPException(status_code=403, detail="Only a platform super admin can archive an event")

    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status == "archived":
        return {"ok": True, "status": "archived"}

    event.status = "archived"
    event.archived_at = datetime.now(UTC)

    # Notify every attendee (RSVP) that the event is being retired.
    rsvps = (await db.execute(select(EventRSVP).where(EventRSVP.event_id == event_id))).scalars().all()
    for r in rsvps:
        db.add(Notification(
            user_id=r.user_id,
            actor_id=current_user.id,
            type=NotificationType.system,
            message=f'The event "{event.title}" is being retired and will be archived. It will no longer appear in listings.',
            link=f"/events/{event_id}",
        ))

    await log_moderation(
        db, action="archive_event", target_type="event", target_id=event_id,
        actor_id=current_user.id, meta={"attendee_count": len(rsvps)},
    )
    await db.commit()
    return {"ok": True, "status": "archived", "notified": len(rsvps)}


# ── Comments ──

@router.get("/comments", response_model=list[CommentResponse])
async def list_comments(
    entity_type: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = select(Comment, User.name).join(User, Comment.user_id == User.id, isouter=True)
    if entity_type:
        stmt = stmt.where(Comment.entity_type == entity_type)
    stmt = stmt.order_by(Comment.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        CommentResponse(
            id=c.id, entity_type=c.entity_type, entity_id=c.entity_id,
            user_id=c.user_id, user_name=name, parent_id=c.parent_id,
            body=c.body, created_at=c.created_at, replies=[],
        )
        for c, name in rows
    ]


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    await db.execute(delete(Comment).where(Comment.id == comment_id))
    await db.commit()


# ── Broadcast ──

@router.post("/broadcast")
async def broadcast_notification(
    message: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    result = await db.execute(select(User.id))
    user_ids = result.scalars().all()
    for uid in user_ids:
        db.add(Notification(
            user_id=uid,
            actor_id=current_user.id,
            type=NotificationType.system,
            message=message,
            link="/",
        ))
    await db.commit()
    return {"sent_to": len(user_ids)}


# ── Tickets Management ──

@router.get("/tickets")
async def admin_list_tickets(
    event_id: int | None = None,
    ticket_type: str | None = None,
    payment_status: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = (
        select(EventTicket, Event.title.label("event_title"), User.name.label("user_name"), User.email.label("user_email"))
        .join(Event, EventTicket.event_id == Event.id)
        .join(User, EventTicket.user_id == User.id)
    )
    if event_id:
        stmt = stmt.where(EventTicket.event_id == event_id)
    if ticket_type:
        stmt = stmt.where(EventTicket.ticket_type == ticket_type)
    if payment_status:
        stmt = stmt.where(EventTicket.payment_status == payment_status)
    if q:
        stmt = stmt.where(or_(User.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))
    stmt = stmt.order_by(EventTicket.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": t.id, "event_id": t.event_id, "event_title": event_title,
            "user_id": t.user_id, "user_name": user_name, "user_email": user_email,
            "ticket_type": t.ticket_type, "price": t.price, "quantity": t.quantity,
            "total_paid": t.total_paid, "payment_status": t.payment_status,
            "checked_in": t.checked_in, "checked_in_at": t.checked_in_at,
            "created_at": t.created_at,
        }
        for t, event_title, user_name, user_email in rows
    ]


@router.get("/tickets/stats")
async def admin_ticket_stats(
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    total = await db.scalar(select(func.count(EventTicket.id))) or 0
    revenue = await db.scalar(select(func.coalesce(func.sum(EventTicket.total_paid), 0))) or 0
    by_type = await db.execute(
        select(EventTicket.ticket_type, func.count(EventTicket.id))
        .group_by(EventTicket.ticket_type)
    )
    by_event = await db.execute(
        select(Event.title, func.count(EventTicket.id), func.coalesce(func.sum(EventTicket.total_paid), 0))
        .join(Event, EventTicket.event_id == Event.id)
        .group_by(Event.id)
    )
    return {
        "total_tickets": total,
        "total_revenue": revenue,
        "by_type": [{"type": t, "count": c} for t, c in by_type.all()],
        "by_event": [{"event_title": t, "count": c, "revenue": r} for t, c, r in by_event.all()],
    }


# ── Donations Management ──

@router.get("/donations")
async def admin_list_donations(
    event_id: int | None = None,
    is_anonymous: bool | None = None,
    payment_status: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = (
        select(EventDonation, Event.title.label("event_title"))
        .join(Event, EventDonation.event_id == Event.id)
    )
    if event_id:
        stmt = stmt.where(EventDonation.event_id == event_id)
    if is_anonymous is not None:
        stmt = stmt.where(EventDonation.is_anonymous == is_anonymous)
    if payment_status:
        stmt = stmt.where(EventDonation.payment_status == payment_status)
    if q:
        stmt = stmt.where(or_(EventDonation.donor_name.ilike(f"%{q}%"), EventDonation.donor_email.ilike(f"%{q}%")))
    stmt = stmt.order_by(EventDonation.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": d.id, "event_id": d.event_id, "event_title": event_title,
            "user_id": d.user_id, "amount": d.amount, "currency": d.currency,
            "donor_name": "Anonymous" if d.is_anonymous else d.donor_name,
            "donor_email": "Anonymous" if d.is_anonymous else d.donor_email,
            "message": d.message, "is_anonymous": d.is_anonymous,
            "payment_method": d.payment_method, "payment_status": d.payment_status,
            "created_at": d.created_at,
        }
        for d, event_title in rows
    ]


@router.get("/donations/stats")
async def admin_donation_stats(
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    total = await db.scalar(
        select(func.coalesce(func.sum(EventDonation.amount), 0))
        .where(EventDonation.payment_status == "completed")
    ) or 0
    count = await db.scalar(
        select(func.count(EventDonation.id))
        .where(EventDonation.payment_status == "completed")
    ) or 0
    by_event = await db.execute(
        select(Event.title, func.count(EventDonation.id), func.coalesce(func.sum(EventDonation.amount), 0))
        .join(Event, EventDonation.event_id == Event.id)
        .where(EventDonation.payment_status == "completed")
        .group_by(Event.id)
    )
    return {
        "total_raised": total,
        "total_donations": count,
        "by_event": [{"event_title": t, "count": c, "total": r} for t, c, r in by_event.all()],
    }


# ── Sponsors Management ──

@router.get("/sponsors")
async def admin_list_sponsors(
    event_id: int | None = None,
    tier: str | None = None,
    agreement_status: str | None = None,
    is_active: bool | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = (
        select(EventSponsor, Event.title.label("event_title"))
        .join(Event, EventSponsor.event_id == Event.id)
    )
    if event_id:
        stmt = stmt.where(EventSponsor.event_id == event_id)
    if tier:
        stmt = stmt.where(EventSponsor.tier == tier)
    if agreement_status:
        stmt = stmt.where(EventSponsor.agreement_status == agreement_status)
    if is_active is not None:
        stmt = stmt.where(EventSponsor.is_active == is_active)
    if q:
        stmt = stmt.where(EventSponsor.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(EventSponsor.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": s.id, "event_id": s.event_id, "event_title": event_title,
            "name": s.name, "logo_url": s.logo_url, "tier": s.tier,
            "contribution": s.contribution, "contact_name": s.contact_name,
            "contact_email": s.contact_email, "agreement_url": s.agreement_url,
            "agreement_status": s.agreement_status, "is_active": s.is_active,
            "visible_to_attendees": s.visible_to_attendees, "created_at": s.created_at,
        }
        for s, event_title in rows
    ]


@router.patch("/sponsors/{sponsor_id}")
async def admin_update_sponsor(
    sponsor_id: int,
    body: SponsorUpdate,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(select(EventSponsor).where(EventSponsor.id == sponsor_id))
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(sponsor, key, val)
    await db.commit()
    await db.refresh(sponsor)
    return sponsor


@router.delete("/sponsors/{sponsor_id}", status_code=204)
async def admin_delete_sponsor(
    sponsor_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    await db.execute(delete(EventSponsor).where(EventSponsor.id == sponsor_id))
    await db.commit()


# ── Vendors Management ──

@router.get("/vendors")
async def admin_list_vendors(
    event_id: int | None = None,
    service_type: str | None = None,
    status: str | None = None,
    agreement_status: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = (
        select(EventVendor, Event.title.label("event_title"))
        .join(Event, EventVendor.event_id == Event.id)
    )
    if event_id:
        stmt = stmt.where(EventVendor.event_id == event_id)
    if service_type:
        stmt = stmt.where(EventVendor.service_type == service_type)
    if status:
        stmt = stmt.where(EventVendor.status == status)
    if agreement_status:
        stmt = stmt.where(EventVendor.agreement_status == agreement_status)
    if q:
        stmt = stmt.where(EventVendor.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(EventVendor.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": v.id, "event_id": v.event_id, "event_title": event_title,
            "name": v.name, "service_type": v.service_type, "cost": v.cost,
            "status": v.status, "contact_name": v.contact_name,
            "contact_email": v.contact_email, "contract_url": v.contract_url,
            "agreement_status": v.agreement_status, "visible_to_attendees": v.visible_to_attendees,
            "created_at": v.created_at,
        }
        for v, event_title in rows
    ]


@router.patch("/vendors/{vendor_id}")
async def admin_update_vendor(
    vendor_id: int,
    body: VendorUpdate,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(select(EventVendor).where(EventVendor.id == vendor_id))
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(vendor, key, val)
    await db.commit()
    await db.refresh(vendor)
    return vendor


@router.delete("/vendors/{vendor_id}", status_code=204)
async def admin_delete_vendor(
    vendor_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    await db.execute(delete(EventVendor).where(EventVendor.id == vendor_id))
    await db.commit()


# ── Configuration / Settings (admin-only) ──────────────────────────────

@router.get("/settings", response_model=list[SettingResponse])
async def list_settings(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    stmt = select(Setting).order_by(Setting.category, Setting.key)
    if category:
        stmt = stmt.where(Setting.category == category)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/settings/{key}", response_model=SettingResponse)
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.put("/settings/{key}", response_model=SettingResponse)
async def update_setting(
    key: str,
    body: SettingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = body.value
        if body.description is not None:
            setting.description = body.description
        setting.updated_by = current_user.id
    else:
        setting = Setting(
            key=key,
            value=body.value,
            description=body.description,
            updated_by=current_user.id,
        )
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting
