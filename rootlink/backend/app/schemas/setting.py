from typing import Any

from pydantic import BaseModel


class SettingResponse(BaseModel):
    id: int
    key: str
    value: Any
    category: str
    description: str | None = None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: Any
    description: str | None = None


class CategoryItem(BaseModel):
    value: str
    label: str
    label_pt: str | None = None
