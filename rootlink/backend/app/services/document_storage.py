"""Generic, content-addressed local-filesystem storage for verification
documents — Phase 5 (docs/roles-permissions/assessment.md §10a). See `app.models.entity.EntityDocument`'s
docstring for why this is a small sibling of `app.services.image_storage`
rather than a reuse of the image-processing pipeline itself (that pipeline
is Pillow-based and cannot handle PDFs, and re-encoding a legal document
into WebP would be a correctness bug, not an optimization).

Same interface shape as `ImageStorage` (save/get_path/delete) for
consistency, deliberately without any resize/format-conversion step.
"""

import hashlib
from pathlib import Path

from app.core.config import settings

# Conservative allow-list: PDFs (the common case for business registration
# certificates) plus the same image formats users might photograph a paper
# document with. Executable/script content types are never allowed.
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_SIZE_BYTES = 15 * 1024 * 1024  # 15MB


class DocumentValidationError(Exception):
    pass


def validate_document(data: bytes, content_type: str) -> None:
    if len(data) > MAX_SIZE_BYTES:
        raise DocumentValidationError(
            f"File too large: {len(data) / 1024 / 1024:.1f}MB (max {MAX_SIZE_BYTES // (1024 * 1024)}MB)"
        )
    if len(data) < 16:
        raise DocumentValidationError("File too small to be a valid document")
    if content_type not in ALLOWED_CONTENT_TYPES:
        allowed = ", ".join(sorted(ALLOWED_CONTENT_TYPES))
        raise DocumentValidationError(f"Content type '{content_type}' not allowed. Allowed: {allowed}")


def compute_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


_EXT_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class DocumentStorage:
    def __init__(self, base_dir: Path | None = None):
        self.base_dir = base_dir or Path(settings.media_dir) / "documents"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, content_type: str) -> tuple[str, str]:
        """Saves the raw bytes, content-addressed by sha256. Returns
        (relative_path, sha256) — relative_path is relative to `media_dir`,
        matching `ImageStorage`'s own convention."""
        digest = compute_hash(data)
        ext = _EXT_BY_CONTENT_TYPE.get(content_type, "bin")
        path = self.base_dir / f"{digest}.{ext}"
        if not path.exists():
            path.write_bytes(data)
        return str(Path("documents") / f"{digest}.{ext}"), digest

    def get_path(self, relative: str) -> Path | None:
        full = self.base_dir.parent / relative
        if full.exists():
            return full
        return None


storage = DocumentStorage()
