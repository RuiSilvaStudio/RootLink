import httpx
from itemadapter import ItemAdapter


class ContentPipeline:
    async def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        title = adapter.get("title", "")
        text = adapter.get("text", "")
        url = adapter.get("url", "")
        category = adapter.get("category", "homesteading")
        content_type = adapter.get("content_type", "article")

        if not text:
            return item

        payload = {
            "title": title,
            "full_text": text,
            "summary": text[:500] if len(text) > 500 else text,
            "url": url,
            "category": category,
            "content_type": content_type,
            "source": "crawled",
            "source_url": url,
        }

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    "http://backend:8000/api/content/index",
                    json=payload,
                    timeout=30,
                )
                if resp.status_code == 201:
                    spider.logger.info(f"Indexed: {url}")
                else:
                    spider.logger.warning(f"Failed to index {url}: {resp.status_code} {resp.text}")
            except httpx.RequestError as e:
                spider.logger.error(f"Request error for {url}: {e}")

        return item
