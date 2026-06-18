from datetime import datetime

from pydantic import BaseModel

from app.models.image_asset import ImageSource


class ImageAssetResponse(BaseModel):
    id: int
    hash: str
    original_format: str
    normalized_format: str
    width: int
    height: int
    file_size_bytes: int
    source_type: ImageSource
    source_url: str | None = None
    source_domain: str | None = None
    author: str | None = None
    license: str | None = None
    attribution_text: str | None = None
    uploaded_by: int | None = None
    status: str = "active"
    path_original: str
    path_large: str
    path_medium: str
    path_thumb: str
    urls: dict[str, str] | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ImageUploadResponse(BaseModel):
    asset: ImageAssetResponse
    message: str = "Image processed successfully"


class ImageFromUrlRequest(BaseModel):
    url: str
    source_type: ImageSource = ImageSource.manual_url
    author: str | None = None
    license: str | None = None
    attribution_text: str | None = None
