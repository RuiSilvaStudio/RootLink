import asyncio
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import settings

_model: SentenceTransformer | None = None
_executor = ThreadPoolExecutor(max_workers=1)


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.embedding_model)
    return _model


def _embed_text_sync(text: str) -> list[float]:
    model = get_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def _embed_batch_sync(texts: list[str]) -> list[list[float]]:
    model = get_model()
    vecs = model.encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vecs]


async def embed_text(text: str) -> list[float]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _embed_text_sync, text)


async def embed_batch(texts: list[str]) -> list[list[float]]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _embed_batch_sync, texts)
