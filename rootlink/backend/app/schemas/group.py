from datetime import datetime

from pydantic import BaseModel

from app.models.group import MemberRole


class GroupResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    category: str | None = None
    family: str | None = None
    image_url: str | None = None
    created_by: int
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    category: str | None = None
    family: str | None = None
    image_url: str | None = None


class GroupMemberResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    role: MemberRole
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
