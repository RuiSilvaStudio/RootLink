"""Test harness: isolated in-memory SQLite + ASGI client with dependency overrides.

The app's real lifespan (which migrates the production DB) is never triggered —
ASGITransport does not run startup events. Tables are created directly from the
SQLAlchemy models, which are the source of truth.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.main as main
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.base import Base
from app.models.user import User

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # single shared connection so :memory: persists across sessions
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(session_factory):
    async def override_get_db():
        async with session_factory() as session:
            yield session

    main.app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    main.app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def make_user(session_factory):
    """Factory: create a User row and return (user, auth_headers)."""

    async def _make(email="u@example.com", role="user", password="secret123", **extra):
        async with session_factory() as session:
            user = User(
                email=email,
                name=email.split("@")[0],
                password_hash=hash_password(password),
                role=role,
                **extra,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            token = create_access_token({"sub": str(user.id)})
            return user, {"Authorization": f"Bearer {token}"}

    return _make
