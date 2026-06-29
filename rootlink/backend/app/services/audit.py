"""Helper to append moderation/enforcement decisions to the audit log.

The caller is responsible for committing the surrounding transaction
(see docs/content-platform/CONTENT_PLATFORM.md §8).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.moderation import ModerationAuditLog


async def log_moderation(
    db: AsyncSession,
    *,
    action: str,
    target_type: str,
    target_id: int | None = None,
    actor_id: int | None = None,
    actor_label: str | None = None,
    reason: str | None = None,
    reason_category: str | None = None,
    meta: dict | None = None,
) -> None:
    db.add(
        ModerationAuditLog(
            actor_id=actor_id,
            actor_label=actor_label,
            action=str(action),
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            reason_category=reason_category,
            meta=meta,
        )
    )
