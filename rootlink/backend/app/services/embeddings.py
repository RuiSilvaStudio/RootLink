import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger("app.embeddings")

_model = None
_executor = ThreadPoolExecutor(max_workers=1)
_model_available = False

try:
    from sentence_transformers import SentenceTransformer
    from app.core.config import settings
    _model_available = True
except ImportError:
    logger.warning("sentence-transformers not installed — semantic search will use keyword-only fallback")


def get_model():
    global _model
    if _model is None and _model_available:
        try:
            _model = SentenceTransformer(settings.embedding_model)
        except Exception as e:
            logger.warning(f"Failed to load embedding model: {e} — using keyword-only search")
            return None
    return _model


def _embed_text_sync(text: str) -> list[float]:
    model = get_model()
    if model is None:
        return []
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def _embed_batch_sync(texts: list[str]) -> list[list[float]]:
    model = get_model()
    if model is None:
        return [[] for _ in texts]
    vecs = model.encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vecs]


async def embed_text(text: str) -> list[float]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _embed_text_sync, text)


async def embed_batch(texts: list[str]) -> list[list[float]]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _embed_batch_sync, texts)
