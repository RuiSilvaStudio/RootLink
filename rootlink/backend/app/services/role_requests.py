"""Promote/demote request+approval workflow (docs/roles-permissions/ROLES_PERMISSIONS.md §6, replacing the
direct `PATCH /api/admin/users/{id}/role` toggle for the new entity/rank
model — that legacy endpoint is untouched; this is new, additive
infrastructure alongside it, per Phase 3's own precedent of not silently
changing existing thresholds).

Rules enforced here (docs/roles-permissions/ROLES_PERMISSIONS.md §6):
- A rank can only promote/demote someone to a rank **below its own** — never
  to its own rank or above.
- Promotions/demotions require sign-off from the rank above the actor,
  **except** the super admin and a capped entity's top rank (professional's
  `admin`; any entity's super admin), who are self-exempt.
- Separation of duties: the approver can never be the same person as the
  requester — independent of rank checks (docs/roles-permissions/ROLES_PERMISSIONS.md §6 "Separation of
  duties").
- Every request/decision is logged.

**Judgment call — the self-approval exemption as a generic rule** (flagged
per the session briefing's own precedent for `entity_kind`/`rank_at_least`):
docs/roles-permissions/ROLES_PERMISSIONS.md §6 names exactly two exempt cases ("super admin" and "a capped
entity's top rank, e.g. professional's admin"). Rather than special-case
those two literally, this implements the *general* rule those two cases are
both instances of: an actor is self-exempt whenever their rank equals their
own entity's ceiling (`app.core.entity_resolution.ENTITY_CEILING`) — i.e.
nobody outranks them **locally**, which is exactly why an approval
requirement ("sign-off from the rank above") is impossible to satisfy for
them. Verified by a dedicated test that this produces exactly the two
documented exemptions and no others (individual's ceiling is contributor,
which can never reach the required moderator/admin floor to submit a
request in the first place, so it never actually exercises the exemption in
practice; partners/suppliers, ceiling persona, same reasoning).

**Decided, not a gap (docs/roles-permissions/phase0-decisions.md Addendum 5):
`professional`/`individual` entity_kind requests are blocked outright,
permanently — this workflow is organization-only by design.** Only
`organization`/`partners`/`suppliers` have a real `entities` row linking
their members together; `professional`/`individual` accounts never get one
and never will (professional-kind users' rank changes are handled directly
by the platform via the existing `/admin/users` role-management page, not
through this entity-scoped request+approval workflow — there is no "team"
to manage rank within for either of these two entity kinds). This was originally flagged (Phase 4, docs/roles-permissions/phase0-decisions.md
Addendum 3) as a gap pending a future "professional team" schema decision;
the product owner has since confirmed (Addendum 5) there will be no such
schema — professional/individual entities never get this capability. The
block implemented below is therefore permanent product behavior, not a
placeholder for a future unblock.
"""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.entity_resolution import ENTITY_CEILING, resolve_entity_and_rank
from app.core.permissions_registry import get as registry_get
from app.models.moderation import ModerationAction
from app.models.role_request import RoleChangeDirection, RoleChangeRequest, RoleChangeStatus
from app.models.user import User
from app.services.audit import log_moderation

_NO_TEAM_MODEL_ENTITIES = {"individual", "professional"}


class RoleRequestError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def is_self_approval_exempt(entity_kind: str, rank: int) -> bool:
    """True when `rank` is already at `entity_kind`'s ceiling — nobody
    outranks this actor locally, so no approval chain can exist for them."""
    ceiling = ENTITY_CEILING.get(entity_kind)
    return ceiling is not None and rank >= ceiling


async def submit_role_change_request(
    db: AsyncSession, requester: User, target: User, *, to_rank: int, reason: str | None = None,
) -> RoleChangeRequest:
    if requester.id == target.id:
        raise RoleRequestError("Cannot submit a role-change request about yourself")

    req_entity_kind, req_rank = resolve_entity_and_rank(requester)
    tgt_entity_kind, tgt_rank = resolve_entity_and_rank(target)

    is_platform_actor = req_entity_kind == "platform"

    if not is_platform_actor:
        if req_entity_kind in _NO_TEAM_MODEL_ENTITIES:
            raise RoleRequestError(
                f"'{req_entity_kind}' entities have no shared team model and never will — "
                "this workflow is organization-only by design (docs/roles-permissions/"
                "phase0-decisions.md Addendum 5); rank changes for this entity kind are "
                "handled directly via /admin/users instead"
            )
        if req_entity_kind != tgt_entity_kind:
            raise RoleRequestError("Requester and target must belong to the same entity")
        if req_entity_kind in ("organization", "partners", "suppliers"):
            if not requester.entity_id or requester.entity_id != target.entity_id:
                raise RoleRequestError("Requester and target must belong to the same entity")

    if to_rank == tgt_rank:
        raise RoleRequestError("Target is already at that rank")
    if to_rank >= req_rank:
        raise RoleRequestError("Cannot set a target's rank at or above your own")
    if to_rank < 0:
        raise RoleRequestError("Invalid target rank")

    direction = RoleChangeDirection.promote if to_rank > tgt_rank else RoleChangeDirection.demote
    action_key = "user.promote" if direction == RoleChangeDirection.promote else "user.demote"
    floor = registry_get(action_key).min_rank
    if req_rank < floor:
        raise RoleRequestError(f"Rank {req_rank} may not {direction} — requires at least rank {floor}")

    exempt = is_self_approval_exempt(req_entity_kind, req_rank)

    # The request is always scoped to the TARGET's own entity context (which,
    # for the non-platform-actor branch above, is already verified to match
    # the requester's own) — this stays correct regardless of whether the
    # actor is the target's own entity or an overriding platform actor.
    request = RoleChangeRequest(
        entity_kind=tgt_entity_kind,
        entity_id=target.entity_id,
        target_user_id=target.id,
        requested_by=requester.id,
        requested_by_rank=req_rank,
        from_rank=tgt_rank,
        to_rank=to_rank,
        direction=direction,
        status=RoleChangeStatus.pending,
        reason=reason,
    )
    db.add(request)
    await db.flush()

    await log_moderation(
        db, action=ModerationAction.request_role_change, target_type="user", target_id=target.id,
        actor_id=requester.id, reason=reason,
        meta={"request_id": request.id, "direction": direction, "from_rank": tgt_rank, "to_rank": to_rank},
    )

    if exempt:
        await _decide(
            db, request, approver=requester, target=target, approve=True,
            reason=reason, self_approved=True,
        )

    return request


async def approve_role_change_request(
    db: AsyncSession, approver: User, request: RoleChangeRequest, target: User, *, reason: str | None = None,
) -> RoleChangeRequest:
    _check_approver(approver, request)
    return await _decide(db, request, approver=approver, target=target, approve=True, reason=reason, self_approved=False)


async def reject_role_change_request(
    db: AsyncSession, approver: User, request: RoleChangeRequest, *, reason: str | None = None,
) -> RoleChangeRequest:
    _check_approver(approver, request)
    return await _decide(db, request, approver=approver, target=None, approve=False, reason=reason, self_approved=False)


def _check_approver(approver: User, request: RoleChangeRequest) -> None:
    if request.status != RoleChangeStatus.pending:
        raise RoleRequestError("Request has already been decided")
    # Separation of duties (docs/roles-permissions/ROLES_PERMISSIONS.md §6) — independent of rank checks.
    if approver.id == request.requested_by:
        raise RoleRequestError("Approver cannot be the same person as the requester")

    approver_entity_kind, approver_rank = resolve_entity_and_rank(approver)
    if approver_entity_kind == "platform":
        return  # entity precedence — platform always overrides.

    if approver_entity_kind != request.entity_kind:
        raise RoleRequestError("Approver must act within the same entity as the request")
    if request.entity_id is not None and approver.entity_id != request.entity_id:
        raise RoleRequestError("Approver must act within the same entity as the request")
    if approver_rank <= request.requested_by_rank:
        raise RoleRequestError("Approval must come from a rank above the original requester")


def can_approve(approver: User, request: RoleChangeRequest) -> bool:
    """Non-raising mirror of `_check_approver` — Phase 5's
    `GET /api/role-requests?scope=pending-approval` listing needs to FILTER
    a set of pending requests down to the ones a given user could act on,
    rather than raise/catch per candidate. Kept as a thin wrapper (not a
    refactor of `_check_approver` itself) so the exception-raising path used
    by `approve_role_change_request`/`reject_role_change_request` — already
    covered by Phase 4's own test suite — is untouched."""
    try:
        _check_approver(approver, request)
    except RoleRequestError:
        return False
    return True


async def _decide(
    db: AsyncSession, request: RoleChangeRequest, *, approver: User, target: User | None,
    approve: bool, reason: str | None, self_approved: bool,
) -> RoleChangeRequest:
    request.decided_by = approver.id
    request.decided_at = datetime.now(UTC)
    request.decision_reason = reason
    request.self_approved = self_approved

    if approve:
        request.status = RoleChangeStatus.approved
        if target is not None:
            target.rank = request.to_rank
        action = ModerationAction.promote if request.direction == RoleChangeDirection.promote else ModerationAction.demote
        await log_moderation(
            db, action=action, target_type="user", target_id=request.target_user_id,
            actor_id=approver.id, reason=reason,
            meta={
                "request_id": request.id,
                "requested_by": request.requested_by,
                "from_rank": request.from_rank,
                "to_rank": request.to_rank,
                "self_approved": self_approved,
            },
        )
    else:
        request.status = RoleChangeStatus.rejected
        await log_moderation(
            db, action=ModerationAction.reject_role_change, target_type="user",
            target_id=request.target_user_id, actor_id=approver.id, reason=reason,
            meta={"request_id": request.id, "requested_by": request.requested_by},
        )

    return request
