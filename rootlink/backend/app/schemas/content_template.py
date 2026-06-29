from pydantic import BaseModel


class ContentTemplateResponse(BaseModel):
    id: int
    kind: str
    key: str
    label_en: str
    label_pt: str
    description_en: str | None = None
    description_pt: str | None = None
    icon: str | None = None
    body: dict | None = None
    sort_order: int = 0
    is_active: bool = True

    model_config = {"from_attributes": True}


class ContentTemplateCreate(BaseModel):
    kind: str = "article"
    key: str
    label_en: str
    label_pt: str
    description_en: str | None = None
    description_pt: str | None = None
    icon: str | None = None
    body: dict | None = None
    sort_order: int = 0
    is_active: bool = True


class ContentTemplateUpdate(BaseModel):
    kind: str | None = None
    key: str | None = None
    label_en: str | None = None
    label_pt: str | None = None
    description_en: str | None = None
    description_pt: str | None = None
    icon: str | None = None
    body: dict | None = None
    sort_order: int | None = None
    is_active: bool | None = None
