import logging
import sys

from app.core.config import settings

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
)


def setup_logging():
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not root.handlers:
        root.addHandler(_handler)

    if settings.secret_key == "dev-secret-key-change-in-production":
        logging.getLogger("app").warning(
            "Using default secret key — set SECRET_KEY in .env for production!"
        )

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
