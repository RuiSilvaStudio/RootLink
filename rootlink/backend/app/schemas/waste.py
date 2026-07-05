from datetime import datetime

from pydantic import BaseModel


class HubCreate(BaseModel):
    name: str
    description: str | None = None
    location: str
    lat: float | None = None
    lng: float | None = None
    capacity_kg_week: float | None = None
    accepted_materials: list[str] | None = None
    operating_hours: str | None = None
    is_public: bool = True
    image_url: str | None = None


class HubUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    capacity_kg_week: float | None = None
    accepted_materials: list[str] | None = None
    operating_hours: str | None = None
    is_public: bool | None = None
    # Owner-settable states only (active/full/closed) — "archived" is a
    # separate, platform-super-admin-only action (see /hubs/{id}/archive),
    # never settable through this endpoint even by the hub's own manager.
    status: str | None = None
    image_url: str | None = None


class HubResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    manager_id: int
    manager_name: str | None = None
    # Lets the frontend decide whether to show the "edit" affordance to an
    # organization's own super admin editing a fellow member's listing
    # (docs/roles-permissions/ROLES_PERMISSIONS.md §7's 🔑 tier) — null for
    # individual/professional managers, who have no entity of subordinates.
    manager_entity_id: int | None = None
    location: str
    lat: float | None = None
    lng: float | None = None
    capacity_kg_week: float | None = None
    accepted_materials: list[str] = []
    operating_hours: str | None = None
    is_public: bool = True
    status: str = "active"
    image_url: str | None = None
    current_volume_kg: float = 0.0
    member_count: int = 0
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DepositCreate(BaseModel):
    weight_kg: float
    material_type: str | None = None
    notes: str | None = None


class DepositResponse(BaseModel):
    id: int
    hub_id: int
    user_id: int
    user_name: str | None = None
    weight_kg: float
    material_type: str | None = None
    notes: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UpcyclingCreate(BaseModel):
    title: str
    description: str | None = None
    materials_used: list[str] | None = None
    before_images: list[str] | None = None
    after_images: list[str] | None = None
    estimated_waste_diverted_kg: float | None = None
    difficulty: str | None = None
    time_spent_hours: float | None = None
    status: str = "published"
    family: str | None = None
    category: str | None = None


class UpcyclingResponse(BaseModel):
    id: int
    creator_id: int
    creator_name: str | None = None
    creator_verified: bool = False
    title: str
    description: str | None = None
    materials_used: list[str] = []
    before_images: list[str] = []
    after_images: list[str] = []
    estimated_waste_diverted_kg: float | None = None
    difficulty: str | None = None
    time_spent_hours: float | None = None
    status: str = "published"
    family: str | None = None
    category: str | None = None
    view_count: int = 0
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ChallengeCreate(BaseModel):
    title: str
    description: str | None = None
    target_kg: float = 1000.0
    start_date: str | None = None
    end_date: str | None = None
    image_url: str | None = None


class ChallengeResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    target_kg: float
    current_kg: float = 0.0
    start_date: str | None = None
    end_date: str | None = None
    organizer_id: int
    status: str = "active"
    image_url: str | None = None
    created_at: datetime | None = None
    progress_pct: float = 0.0

    model_config = {"from_attributes": True}
