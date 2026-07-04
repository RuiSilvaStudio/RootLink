"""Verification document upload/listing for `entities` rows — Phase 5
(docs/roles-permissions/assessment.md §10a). See `app.models.entity.EntityDocument` and
`app.services.document_storage` for why this is a small sibling of the
image-upload pipeline rather than a reuse of it outright.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity, EntityDocument
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation
from app.services.document_storage import DocumentValidationError, storage, validate_document


class EntityDocumentError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def can_manage_entity_documents(user: User, entity: Entity) -> bool:
    """Who may upload/view an entity's verification documents: the
    registrant/primary contact, any already-bootstrapped member of the same
    entity, or platform staff (the review queue needs to see them too —
    gated separately at the endpoint layer for platform-admin-only listing
    of the whole queue)."""
    if entity.primary_contact_user_id == user.id:
        return True
    if user.entity_id is not None and user.entity_id == entity.id:
        return True
    return False


async def upload_document(
    db: AsyncSession,
    uploader: User,
    entity: Entity,
    *,
    data: bytes,
    filename: str,
    content_type: str,
) -> EntityDocument:
    try:
        validate_document(data, content_type)
    except DocumentValidationError as e:
        raise EntityDocumentError(str(e)) from None

    rel_path, digest = storage.save(data, content_type)
    doc = EntityDocument(
        entity_id=entity.id,
        uploaded_by=uploader.id,
        filename=filename[:255],
        content_type=content_type,
        size_bytes=len(data),
        storage_path=rel_path,
        sha256=digest,
    )
    db.add(doc)
    await db.flush()

    await log_moderation(
        db, action=ModerationAction.upload_entity_document, target_type="entity",
        target_id=entity.id, actor_id=uploader.id,
        meta={"document_id": doc.id, "filename": doc.filename},
    )
    return doc


async def list_documents(db: AsyncSession, entity_id: int) -> list[EntityDocument]:
    rows = (
        await db.execute(select(EntityDocument).where(EntityDocument.entity_id == entity_id))
    ).scalars().all()
    return list(rows)
