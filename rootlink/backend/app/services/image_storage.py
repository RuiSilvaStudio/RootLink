from pathlib import Path

from app.core.config import settings


class ImageStorage:
    """Local filesystem storage for processed images.

    Swap this class for S3/Cloudflare R2 in production by implementing
    the same save/delete/get_path interface.
    """

    def __init__(self, base_dir: Path | None = None):
        self.base_dir = base_dir or Path(settings.media_dir) / "images"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path_for(self, img_hash: str, size: str) -> Path:
        return self.base_dir / f"{img_hash}_{size}.webp"

    def save(self, img_hash: str, sizes: dict[str, bytes]) -> dict[str, str]:
        """Save all size variants to disk.

        Returns dict mapping size name -> relative path (e.g. "images/abc123_thumb.webp").
        """
        paths = {}
        for size_name, data in sizes.items():
            path = self._path_for(img_hash, size_name)
            path.write_bytes(data)
            paths[size_name] = str(Path("images") / f"{img_hash}_{size_name}.webp")
        return paths

    def delete(self, img_hash: str) -> None:
        """Remove all size variants for a given hash."""
        for size_name in ("original", "large", "medium", "thumb"):
            path = self._path_for(img_hash, size_name)
            if path.exists():
                path.unlink()

    def get_path(self, relative: str) -> Path | None:
        """Resolve a relative path to an absolute path. Returns None if not found."""
        full = self.base_dir.parent / relative
        if full.exists():
            return full
        return None

    def exists(self, img_hash: str) -> bool:
        return self._path_for(img_hash, "thumb").exists()


# Singleton
storage = ImageStorage()
