"""Translation API — machine translation for site copy (Phase 1).

Built on Argos Translate (MIT). See docs/content-platform/ for the full
pipeline spec. Source-of-truth locale is PT; all translations flow outward.

Endpoints:
  POST /api/translate         — single string
  POST /api/translate/bulk    — batch (used by "Auto-translate all empty")

All endpoints are super_admin only — the TM/MT corpus should not be
pollutable by non-admins.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.content_ui import require_super_admin
from app.models.user import User
from app.services.translation_service import translate, translate_bulk

router = APIRouter(prefix="/api/translate", tags=["translate"])


class TranslateRequest(BaseModel):
    source_text: str
    source_locale: str
    target_locale: str


class TranslateResponse(BaseModel):
    value: str
    origin: str


class BulkTranslateItem(BaseModel):
    key: str
    source_text: str


class BulkTranslateRequest(BaseModel):
    items: list[BulkTranslateItem]
    source_locale: str
    target_locale: str


class BulkTranslateResultItem(BaseModel):
    key: str
    value: str
    origin: str
    error: str | None = None


class BulkTranslateResponse(BaseModel):
    results: list[BulkTranslateResultItem]


@router.post("", response_model=TranslateResponse)
async def translate_single(
    body: TranslateRequest,
    _: User = Depends(require_super_admin),
) -> TranslateResponse:
    res = await translate(body.source_text, body.source_locale, body.target_locale)
    return TranslateResponse(value=res["value"], origin=res["origin"])


@router.post("/bulk", response_model=BulkTranslateResponse)
async def translate_many(
    body: BulkTranslateRequest,
    _: User = Depends(require_super_admin),
) -> BulkTranslateResponse:
    items = [{"key": i.key, "source_text": i.source_text} for i in body.items]
    results = await translate_bulk(items, body.source_locale, body.target_locale)
    return BulkTranslateResponse(
        results=[BulkTranslateResultItem(**r) for r in results]
    )
