from pydantic import BaseModel
from datetime import datetime


class ChecklistItemResponse(BaseModel):
    id: int
    user_id: int
    month: int
    task: str
    is_completed: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChecklistItemCreate(BaseModel):
    month: int
    task: str
    sort_order: int = 0


class ChecklistItemUpdate(BaseModel):
    task: str | None = None
    is_completed: bool | None = None
    sort_order: int | None = None
    month: int | None = None
