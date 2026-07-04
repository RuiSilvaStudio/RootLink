"""Cross-entity ban cascade (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Cross-entity ban cascade").

"An entity can have a footprint inside another entity's content — e.g. Org B
listed as a sponsor/vendor on Org A's event... When an entity is banned or
dissolved, that footprint is automatically hidden — a 'soft cascade.'"

**What "footprint" actually is, in this codebase, today** (checked before
writing this, per the session briefing's own instruction not to speculate):
`EventSponsor`/`EventVendor` rows are free-text by default (name/contact
fields) with **no** link to a real platform `Entity` at all. `GroupMember`
only links a `user_id`, never an entity — a group member's own personal
membership is not "an entity's contributed footprint," it's that person's
own standing, and hiding it would conflate this cascade with ordinary
per-user ban handling (already handled by `app.api.admin.ban_user`).

So the only *real* per-Phase-4 footprint mechanism is the new
`contributing_entity_id` FK added to `EventSponsor`/`EventVendor` this phase
(`app/models/event.py`) — only ever non-null when a sponsor/vendor entry is
actually a registered `organization`/`partners`/`suppliers` entity, not for
the (today, overwhelmingly common) free-text case. `GroupMember`-level
footprint is deliberately left out of this cascade for the reason above —
flagged, not silently dropped.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import EventSponsor, EventVendor
from app.services.audit import log_moderation


async def cascade_hide_entity_footprint(
    db: AsyncSession, *, entity_id: int, actor_id: int | None, reason: str | None = None
) -> dict:
    """Hides (never deletes) every sponsor/vendor row contributed by
    `entity_id`. Idempotent — rows already hidden by a previous cascade are
    left untouched (their original `cascade_hidden_at` timestamp survives).
    """
    now = datetime.now(UTC)
    sponsor_ids: list[int] = []
    vendor_ids: list[int] = []

    sponsors = (
        await db.execute(
            select(EventSponsor).where(
                EventSponsor.contributing_entity_id == entity_id,
                EventSponsor.cascade_hidden_at.is_(None),
            )
        )
    ).scalars().all()
    for s in sponsors:
        s.cascade_hidden_at = now
        sponsor_ids.append(s.id)

    vendors = (
        await db.execute(
            select(EventVendor).where(
                EventVendor.contributing_entity_id == entity_id,
                EventVendor.cascade_hidden_at.is_(None),
            )
        )
    ).scalars().all()
    for v in vendors:
        v.cascade_hidden_at = now
        vendor_ids.append(v.id)

    await log_moderation(
        db, action="cascade_hide", target_type="entity", target_id=entity_id,
        actor_id=actor_id, reason=reason,
        meta={"sponsor_ids": sponsor_ids, "vendor_ids": vendor_ids},
    )
    return {"sponsor_ids": sponsor_ids, "vendor_ids": vendor_ids}


async def cascade_restore_entity_footprint(
    db: AsyncSession, *, entity_id: int, actor_id: int | None, reason: str | None = None
) -> dict:
    """Reverses a cascade-hide for `entity_id`'s footprint. Callers are
    responsible for enforcing the grace-window check (docs/roles-permissions/ROLES_PERMISSIONS.md §3: "The
    cascade is reversible within the same 30-day grace period used for
    dissolution") — this function itself does not look at any grace-period
    field, so it can be reused for both the ban-triggered and
    dissolution-triggered grace windows, which use distinct `Entity` columns
    (`ban_cascade_grace_expires_at` vs `dissolution_grace_expires_at`).
    """
    sponsor_ids: list[int] = []
    vendor_ids: list[int] = []

    sponsors = (
        await db.execute(
            select(EventSponsor).where(
                EventSponsor.contributing_entity_id == entity_id,
                EventSponsor.cascade_hidden_at.is_not(None),
            )
        )
    ).scalars().all()
    for s in sponsors:
        s.cascade_hidden_at = None
        sponsor_ids.append(s.id)

    vendors = (
        await db.execute(
            select(EventVendor).where(
                EventVendor.contributing_entity_id == entity_id,
                EventVendor.cascade_hidden_at.is_not(None),
            )
        )
    ).scalars().all()
    for v in vendors:
        v.cascade_hidden_at = None
        vendor_ids.append(v.id)

    await log_moderation(
        db, action="cascade_restore", target_type="entity", target_id=entity_id,
        actor_id=actor_id, reason=reason,
        meta={"sponsor_ids": sponsor_ids, "vendor_ids": vendor_ids},
    )
    return {"sponsor_ids": sponsor_ids, "vendor_ids": vendor_ids}
