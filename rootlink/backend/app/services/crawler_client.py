from app.services.embeddings import embed_batch


class Chunk:
    def __init__(self, title: str, text: str, url: str, source: str, category: str, content_type: str):
        self.title = title
        self.text = text
        self.url = url
        self.source = source
        self.category = category
        self.content_type = content_type


def chunk_text(text: str, max_chars: int = 2000) -> list[str]:
    words = text.split()
    chunks = []
    current: list[str] = []
    current_len = 0

    for word in words:
        if current_len + len(word) + 1 > max_chars and current:
            chunks.append(" ".join(current))
            current = [word]
            current_len = len(word)
        else:
            current.append(word)
            current_len += len(word) + 1

    if current:
        chunks.append(" ".join(current))

    return chunks if chunks else [text]


async def process_content(title: str, text: str, url: str, source: str, category: str, content_type: str):
    chunks = chunk_text(text)
    embeddings = await embed_batch(chunks)

    records = []
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings, strict=False)):
        records.append({
            "title": f"{title} (part {i+1})" if len(chunks) > 1 else title,
            "full_text": chunk,
            "url": url,
            "source": source,
            "category": category,
            "content_type": content_type,
            "embedding": emb,
        })

    return records
