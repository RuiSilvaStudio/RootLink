from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


from app.models.user import UserRole


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
