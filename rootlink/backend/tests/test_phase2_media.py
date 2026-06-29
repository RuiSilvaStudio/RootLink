"""Phase 2 — media: EXIF/GPS stripping (§6.3) and cover-at-publish (§6.4)."""

import io

from PIL import Image

from app.services.default_cover import GENERIC_DEFAULT, default_cover_for
from app.services.image_processor import detect_format, process_image_bytes


def _jpeg_with_exif() -> bytes:
    """A JPEG carrying EXIF metadata (camera make + orientation).

    GPS coordinates live in this same EXIF block, so proving the whole block is
    stripped proves GPS is stripped too (§6.3).
    """
    img = Image.new("RGB", (300, 200), (180, 90, 40))
    exif = Image.Exif()
    exif[0x010F] = "SecretCamera"  # Make
    exif[0x0110] = "HomeGPSModel"  # Model
    exif[0x0112] = 6  # Orientation
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


# ── EXIF / GPS stripping ──

def test_source_jpeg_actually_has_exif():
    data = _jpeg_with_exif()
    assert len(Image.open(io.BytesIO(data)).getexif()) > 0, "fixture must carry EXIF"


def test_processed_image_has_no_exif():
    data = _jpeg_with_exif()
    processed = process_image_bytes(data)
    for name in ("original", "large", "thumb"):
        out = Image.open(io.BytesIO(processed.sizes[name]))
        assert detect_format(processed.sizes[name]) == "webp"
        exif = out.getexif()
        assert len(exif) == 0, f"{name}: EXIF/GPS must be stripped (§6.3)"
        assert 0x010F not in exif and 0x8825 not in exif  # Make + GPS IFD gone


# ── Default cover mapping ──

def test_default_cover_by_family():
    assert default_cover_for(family="gardening").endswith("/gardening.svg")
    assert default_cover_for(family="woodworking").endswith("/woodworking.svg")


def test_default_cover_generic_fallback():
    assert default_cover_for(family="nonsense") == GENERIC_DEFAULT
    assert default_cover_for() == GENERIC_DEFAULT


# ── Cover required at publish ──

async def test_publish_sets_default_cover_when_blank(client, make_user, session_factory):
    from app.models.content import Content

    _, headers = await make_user(email="cover@example.com", can_self_publish=True)
    r = await client.post(
        "/api/articles/",
        headers=headers,
        json={"title": "No cover", "body": {"blocks": []}, "family": "gardening"},
    )
    aid = r.json()["id"]
    pub = await client.post(f"/api/articles/{aid}/publish", headers=headers)
    assert pub.status_code == 200
    assert pub.json()["status"] == "published"
    async with session_factory() as s:
        art = await s.get(Content, aid)
        assert art.image_url, "published article must never be coverless (§6.4)"
        assert art.image_url.endswith("/gardening.svg")
