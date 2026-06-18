import asyncio
import json
from collections import defaultdict


class SSEManager:
    def __init__(self):
        self._queues: dict[int, list[asyncio.Queue]] = defaultdict(list)

    def subscribe(self, user_id: int) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._queues[user_id].append(q)
        return q

    def unsubscribe(self, user_id: int, q: asyncio.Queue):
        qs = self._queues.get(user_id, [])
        if q in qs:
            qs.remove(q)
        if not qs:
            self._queues.pop(user_id, None)

    async def notify(self, user_id: int, data: dict):
        for q in self._queues.get(user_id, []):
            await q.put(data)


sse_manager = SSEManager()
