import asyncio
import hashlib
import io
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageOps

# Enable HEIC/HEIF (iPhone photos) support in Pillow if the optional dep is present.
try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    _HEIF_AVAILABLE = True
except Exception:  # pragma: no cover - missing optional dependency
    _HEIF_AVAILABLE = False

# Format detection via magic bytes (not file extension)
_MAGIC_BYTES = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG": "png",
    b"RIFF": "webp",  # RIFF....WEBP
    b"GIF87a": "gif",
    b"GIF89a": "gif",
    b"BM": "bmp",
    b"II\x2a\x00": "tiff",
    b"MM\x00\x2a": "tiff",
}

# HEIC/HEIF: ISO-BMFF "ftyp" box at offset 4, with one of these brands.
_HEIF_BRANDS = {b"heic", b"heix", b"heim", b"heis", b"hevc", b"hevx", b"mif1", b"msf1", b"heif"}

# Allowed input formats
ALLOWED_INPUT_FORMATS = {"jpeg", "png", "webp", "gif", "bmp", "tiff"}
if _HEIF_AVAILABLE:
    ALLOWED_INPUT_FORMATS.add("heic")

# Size presets: name -> (max_width, max_height, quality)
SIZE_PRESETS = {
    "original": (None, None, 90),
    "large": (1200, 1200, 85),
    "medium": (600, 600, 82),
    "thumb": (200, 200, 80),
}


@dataclass
class ProcessedImage:
    hash: str
    original_format: str
    width: int
    height: int
    file_size_bytes: int
    sizes: dict[str, bytes]  # preset_name -> webp bytes


def detect_format(data: bytes) -> str:
    """Detect image format via magic bytes. Returns format name or raises ValueError."""
    for magic, fmt in _MAGIC_BYTES.items():
        if data[: len(magic)] == magic:
            if fmt == "webp":
                # Verify it's actually WebP, not just any RIFF file
                if len(data) >= 12 and data[8:12] == b"WEBP":
                    return fmt
                continue
            return fmt
    # HEIC/HEIF (iPhone): "ftyp" box at offset 4, brand follows.
    if len(data) >= 12 and data[4:8] == b"ftyp" and any(b in data[8:32] for b in _HEIF_BRANDS):
        return "heic"
    raise ValueError("Unrecognized image format")


def compute_hash(data: bytes) -> str:
    """Compute truncated SHA256 hash for content-addressed storage."""
    return hashlib.sha256(data).hexdigest()[:32]


def validate_upload(
    data: bytes,
    max_mb: int = 10,
    min_width: int = 100,
    min_height: int = 100,
) -> None:
    """Validate an uploaded image. Raises ValueError with descriptive message."""
    max_bytes = max_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise ValueError(f"File too large: {len(data) / 1024 / 1024:.1f}MB (max {max_mb}MB)")

    if len(data) < 100:
        raise ValueError("File too small to be a valid image")

    fmt = detect_format(data)
    if fmt not in ALLOWED_INPUT_FORMATS:
        allowed = ", ".join(sorted(ALLOWED_INPUT_FORMATS))
        raise ValueError(f"Format '{fmt}' is not supported. Allowed: {allowed}")

    try:
        img = Image.open(io.BytesIO(data))
        w, h = img.size
        if w < min_width or h < min_height:
            raise ValueError(
                f"Image too small: {w}x{h}px (minimum {min_width}x{min_height}px)"
            )
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Cannot read image: {e}") from e


def _convert_single(img: Image.Image, max_dim: int | None, quality: int) -> bytes:
    """Convert a PIL Image to WebP bytes with optional max dimension constraint."""
    result = img.copy()
    if max_dim:
        result.thumbnail((max_dim, max_dim), Image.LANCZOS)

    buf = io.BytesIO()
    result.save(buf, format="WEBP", quality=quality, method=4)
    return buf.getvalue()


def process_image_bytes(data: bytes) -> ProcessedImage:
    """Process raw image bytes into multiple WebP sizes.

    Returns ProcessedImage with all size variants.
    Runs synchronously -- call via asyncio.to_thread() for non-blocking use.
    """
    fmt = detect_format(data)
    img_hash = compute_hash(data)

    # Open and auto-orient based on EXIF
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)

    # Privacy / GDPR data-minimisation (CONTENT_PLATFORM.md §6.3): strip ALL
    # embedded metadata (EXIF incl. GPS, XMP, ICC) so uploaded photos can't leak a
    # user's home coordinates. exif_transpose has already baked in orientation; we
    # drop the metadata here and never pass exif=/xmp= to save() below.
    for meta_key in ("exif", "xmp", "icc_profile", "photoshop", "comment"):
        img.info.pop(meta_key, None)
    if hasattr(img, "_exif"):
        img._exif = None

    # Convert to RGB if needed (WebP doesn't support palette or RGBA in all cases cleanly)
    if img.mode not in ("RGB",):
        if img.mode == "RGBA" and fmt in ("png", "webp", "gif"):
            # Keep alpha for transparent formats, WebP supports it
            pass
        else:
            img = img.convert("RGB")

    orig_w, orig_h = img.size

    sizes: dict[str, bytes] = {}
    total_bytes = 0
    for name, (max_dim, _, quality) in SIZE_PRESETS.items():
        webp_data = _convert_single(img, max_dim, quality)
        sizes[name] = webp_data
        total_bytes += len(webp_data)

    return ProcessedImage(
        hash=img_hash,
        original_format=fmt,
        width=orig_w,
        height=orig_h,
        file_size_bytes=total_bytes,
        sizes=sizes,
    )


async def download_image(url: str, timeout: float = 15) -> bytes:
    """Download an image from a URL. Returns raw bytes."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "RootLink/1.0 (image-fetch)"})
        resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")
        if "image" not in content_type and not url.lower().endswith(
            (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif")
        ):
            raise ValueError(f"URL does not point to an image (Content-Type: {content_type})")

        return resp.content


async def process_image_async(data: bytes) -> ProcessedImage:
    """Async wrapper around process_image_bytes to avoid blocking the event loop."""
    return await asyncio.to_thread(process_image_bytes, data)


def extract_source_domain(url: str) -> str | None:
    """Extract the domain from a URL."""
    try:
        parsed = urlparse(url)
        return parsed.netloc or None
    except Exception:
        return None
