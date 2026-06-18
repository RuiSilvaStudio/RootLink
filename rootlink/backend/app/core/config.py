from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    database_url: str = f"sqlite+aiosqlite:///{BASE_DIR}/rootlink.db"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:3000"
    embedding_model: str = "all-MiniLM-L6-v2"
    db_type: str = "sqlite"
    media_dir: str = str(BASE_DIR / "media")
    media_url: str = "http://localhost:8000"
    max_upload_size_mb: int = 10
    image_quality: int = 85

    class Config:
        env_file = ".env"


settings = Settings()
