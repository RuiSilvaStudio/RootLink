from datetime import datetime

from pydantic import BaseModel


class SuspendRequest(BaseModel):
    until: datetime
    reason: str | None = None


class BanRequest(BaseModel):
    reason: str | None = None


class SelfPublishGrant(BaseModel):
    grant: bool = True
