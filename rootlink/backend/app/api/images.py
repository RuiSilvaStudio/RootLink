from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.image_asset import ImageAsset, ImageSource
from app.models.user import User
from app.schemas.image_asset import (
    ImageAssetResponse,
    ImageFromUrlRequest,
    ImageUploadResponse,
)
from app.services.image_processor import (
    download_image,
    extract_source_domain,
    process_image_async,
    validate_upload,
)
from app.services.image_storage import storage

router = APIRouter(prefix="/api/images", tags=["images"])


def _build_urls(asset: ImageAsset) -> dict[str, str]:
    """Build serving URLs for an image asset."""
    base = f"{settings.media_url}/media"
    return {
        "original": f"{base}/{asset.path_original}",
        "large": f"{base}/{asset.path_large}",
        "medium": f"{base}/{asset.path_medium}",
        "thumb": f"{base}/{asset.path_thumb}",
    }


@router.post("/upload", response_model=ImageUploadResponse, status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    source_type: ImageSource = Query(ImageSource.upload),
    author: str | None = Query(None),
    license: str | None = Query(None),
    attribution_text: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload an image file. Any format accepted, normalized to WebP."""
    raw = await file.read()

    try:
        validate_upload(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    processed = await process_image_async(raw)

    # Check for duplicate by hash
    existing = await db.execute(
        select(ImageAsset).where(ImageAsset.hash == processed.hash)
    )
    existing_asset = existing.scalar_one_or_none()
    if existing_asset:
        return ImageUploadResponse(
            asset=ImageAssetResponse.model_validate(existing_asset),
            message="Image already exists (duplicate detected)",
        )

    paths = storage.save(processed.hash, processed.sizes)

    asset = ImageAsset(
        hash=processed.hash,
        original_format=processed.original_format,
        width=processed.width,
        height=processed.height,
        file_size_bytes=processed.file_size_bytes,
        source_type=source_type,
        source_domain=None,
        author=author,
        license=license,
        attribution_text=attribution_text,
        uploaded_by=current_user.id,
        path_original=paths["original"],
        path_large=paths["large"],
        path_medium=paths["medium"],
        path_thumb=paths["thumb"],
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    resp = ImageAssetResponse.model_validate(asset)
    resp.urls = _build_urls(asset)
    return ImageUploadResponse(asset=resp)


@router.post("/from-url", response_model=ImageUploadResponse, status_code=201)
async def upload_image_from_url(
    body: ImageFromUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download an image from a URL and process it."""
    try:
        raw = await download_image(body.url)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to download image: {e}"
        ) from None

    try:
        validate_upload(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    processed = await process_image_async(raw)

    existing = await db.execute(
        select(ImageAsset).where(ImageAsset.hash == processed.hash)
    )
    existing_asset = existing.scalar_one_or_none()
    if existing_asset:
        return ImageUploadResponse(
            asset=ImageAssetResponse.model_validate(existing_asset),
            message="Image already exists (duplicate detected)",
        )

    paths = storage.save(processed.hash, processed.sizes)

    asset = ImageAsset(
        hash=processed.hash,
        original_format=processed.original_format,
        width=processed.width,
        height=processed.height,
        file_size_bytes=processed.file_size_bytes,
        source_type=body.source_type,
        source_url=body.url,
        source_domain=extract_source_domain(body.url),
        author=body.author,
        license=body.license,
        attribution_text=body.attribution_text,
        uploaded_by=current_user.id,
        path_original=paths["original"],
        path_large=paths["large"],
        path_medium=paths["medium"],
        path_thumb=paths["thumb"],
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    resp = ImageAssetResponse.model_validate(asset)
    resp.urls = _build_urls(asset)
    return ImageUploadResponse(asset=resp)


@router.get("/{asset_id}/serve/{size}")
async def serve_image(
    asset_id: int,
    size: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve an image file by asset ID and size."""
    valid_sizes = ("original", "large", "medium", "thumb")
    if size not in valid_sizes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid size. Use: {', '.join(valid_sizes)}",
        )

    result = await db.execute(select(ImageAsset).where(ImageAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Image not found")
    if asset.status == "removed":
        raise HTTPException(status_code=410, detail="Image has been removed")

    rel_path = getattr(asset, f"path_{size}")
    file_path = storage.get_path(rel_path)
    if not file_path:
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(str(file_path), media_type="image/webp")


@router.get("/by-hash/{img_hash}/{size}")
async def serve_image_by_hash(
    img_hash: str,
    size: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve an image by content hash and size. Used by frontend for direct URL access."""
    if size not in ("original", "large", "medium", "thumb"):
        raise HTTPException(status_code=400, detail="Invalid size")

    result = await db.execute(select(ImageAsset).where(ImageAsset.hash == img_hash))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Image not found")
    if asset.status == "removed":
        raise HTTPException(status_code=410, detail="Image has been removed")

    rel_path = getattr(asset, f"path_{size}")
    file_path = storage.get_path(rel_path)
    if not file_path:
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(str(file_path), media_type="image/webp")


@router.get("/{asset_id}", response_model=ImageAssetResponse)
async def get_image_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get image asset metadata."""
    result = await db.execute(select(ImageAsset).where(ImageAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Image not found")

    resp = ImageAssetResponse.model_validate(asset)
    resp.urls = _build_urls(asset)
    return resp


@router.delete("/{asset_id}", status_code=204)
async def delete_image_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete an image asset. Removes files and marks as removed."""
    result = await db.execute(select(ImageAsset).where(ImageAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Image not found")

    asset.status = "removed"
    asset.removed_reason = f"Deleted by user {current_user.id}"
    await db.commit()

    storage.delete(asset.hash)
