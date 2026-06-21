from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    account_type: str = "individual"
    entity_type: str | None = None
    registration_number: str | None = None
    services: list[str] | None = None
    service_area: str | None = None
    modality: str | None = None
    certifications: list[str] | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    bio: str | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    skills: list[str] | None = None
    interests: list[str] | None = None
    avatar_url: str | None = None
    role: UserRole = UserRole.user
    visible_in_network: bool = True
    locale: str | None = None
    account_type: str = "individual"
    entity_type: str | None = None
    registration_number: str | None = None
    services: list[str] | None = None
    service_area: str | None = None
    certifications: list[str] | None = None
    modality: str | None = None
    is_verified: bool = False
    verified_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    skills: list[str] | None = None
    interests: list[str] | None = None
    avatar_url: str | None = None
    visible_in_network: bool | None = None
    locale: str | None = None
    services: list[str] | None = None
    service_area: str | None = None
    certifications: list[str] | None = None
    modality: str | None = None
