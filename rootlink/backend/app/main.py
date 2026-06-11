from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from sqlalchemy import text

from app.core.database import engine
from app.models.base import Base
from app.api import auth, content, groups, events, comments, social, notifications, learning, users, messages, admin, crawl, plants, checklist, farmers_guide


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN visible_in_network BOOLEAN DEFAULT 1"))
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE content ADD COLUMN verification_status VARCHAR DEFAULT 'unreviewed'")
            )
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE content ADD COLUMN cross_referenced_sources JSON")
            )
        except Exception:
            pass
        try:
            await conn.execute(
                text("UPDATE content SET verification_status = 'community_reviewed' WHERE is_validated = 1")
            )
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE content DROP COLUMN is_validated"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN locale VARCHAR(10) DEFAULT NULL"))
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE plants ADD COLUMN soil_texture JSON")
            )
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE plants ADD COLUMN distribution_portugal JSON")
            )
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE plants ADD COLUMN common_names_pt JSON")
            )
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE plants ADD COLUMN common_names_en JSON")
            )
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE plants ADD COLUMN pests JSON")
            )
        except Exception:
            pass
        try:
            await conn.execute(
                text("ALTER TABLE plants ADD COLUMN sources JSON")
            )
        except Exception:
            pass
        for col in ["sow_month_start", "sow_month_end", "transplant_month_start", "transplant_month_end", "harvest_month_start", "harvest_month_end"]:
            try:
                await conn.execute(text(f"ALTER TABLE plants ADD COLUMN {col} INTEGER"))
            except Exception:
                pass
        try:
            await conn.execute(
                text("CREATE TABLE IF NOT EXISTS checklist_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), month INTEGER NOT NULL, task VARCHAR(500) NOT NULL, is_completed BOOLEAN DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
            )
        except Exception as e:
            print(f"checklist migration: {e}")
    yield
    await engine.dispose()


app = FastAPI(title="RootLink API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(content.router)
app.include_router(groups.router)
app.include_router(events.router)
app.include_router(comments.router)
app.include_router(social.router)
app.include_router(notifications.router)
app.include_router(learning.router)
app.include_router(users.router)
app.include_router(messages.router)
app.include_router(admin.router)
app.include_router(crawl.router)
app.include_router(plants.router)
app.include_router(checklist.router)
app.include_router(farmers_guide.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
