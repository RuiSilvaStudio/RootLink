from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api import (
    admin,
    auth,
    checklist,
    comments,
    content,
    crawl,
    events,
    external,
    farmers_guide,
    groups,
    images,
    learning,
    marketplace,
    messages,
    notifications,
    payments,
    plants,
    social,
    taxonomy,
    users,
    waste,
)
from app.core.config import settings
from app.core.database import engine
from app.core.logging import setup_logging
from app.core.rate_limit import RateLimitMiddleware
from app.models.base import Base
from app.models.image_asset import ImageAsset  # noqa: F401 - ensure table creation
from app.models.taxonomy import TaxonomyFamily, TaxonomyCategory, SEED_FAMILIES, SEED_CATEGORIES, CATEGORY_TO_FAMILY_MAP  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN visible_in_network BOOLEAN DEFAULT 1"))
        except Exception:
            pass
        # User account type & entity fields
        for col, typedef in [
            ("account_type", "VARCHAR(20) DEFAULT 'individual'"),
            ("entity_type", "VARCHAR(50)"),
            ("registration_number", "VARCHAR(50)"),
            ("services", "JSON"),
            ("service_area", "VARCHAR(255)"),
            ("certifications", "JSON"),
            ("modality", "VARCHAR(255)"),
            ("is_verified", "BOOLEAN DEFAULT 0"),
            ("verified_at", "TIMESTAMP"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
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
        # Event Manager migrations
        for col, typedef in [
            ("visibility", "VARCHAR(50) DEFAULT 'all'"),
            ("visibility_roles", "JSON"),
            ("status", "VARCHAR(50) DEFAULT 'published'"),
            ("ticket_type", "VARCHAR(50) DEFAULT 'free'"),
            ("ticket_price", "INTEGER"),
            ("currency", "VARCHAR(3) DEFAULT 'EUR'"),
            ("donation_goal", "INTEGER"),
            ("description_long", "TEXT"),
            ("contact_email", "VARCHAR(255)"),
            ("contact_phone", "VARCHAR(50)"),
            ("requirements", "TEXT"),
            ("tags", "JSON"),
            ("image_gallery", "JSON"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Event sponsor/vendor agreement migrations
        for table, col, typedef in [
            ("event_sponsors", "agreement_url", "VARCHAR(2000)"),
            ("event_sponsors", "agreement_status", "VARCHAR(50) DEFAULT 'none'"),
            ("event_vendors", "agreement_status", "VARCHAR(50) DEFAULT 'none'"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Event ticket tiers migration
        try:
            await conn.execute(text("ALTER TABLE events ADD COLUMN ticket_tiers JSON"))
        except Exception:
            pass
        # Event recurrence migrations
        for table, col, typedef in [
            ("events", "recurrence_type", "VARCHAR(50) DEFAULT 'none'"),
            ("events", "recurrence_config", "JSON"),
            ("event_schedule", "day_of_week", "INTEGER"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Polymorphic comments migration
        for col, typedef in [
            ("entity_type", "VARCHAR(50) DEFAULT 'content'"),
            ("entity_id", "INTEGER"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE comments ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Marketplace: add quantity column to listings
        try:
            await conn.execute(text("ALTER TABLE listings ADD COLUMN quantity INTEGER DEFAULT 1"))
        except Exception:
            pass
        # Backfill existing comments from content_id to entity_id
        try:
            await conn.execute(text(
                "UPDATE comments SET entity_id = content_id WHERE entity_id IS NULL AND content_id IS NOT NULL"
            ))
        except Exception:
            pass
        # If old content_id column exists with NOT NULL constraint, recreate table
        try:
            result = await conn.execute(text("PRAGMA table_info(comments)"))
            cols = [r[1] for r in result.fetchall()]
            if "content_id" in cols:
                comment_count = await conn.execute(text("SELECT COUNT(*) FROM comments"))
                if comment_count.scalar() == 0:
                    await conn.execute(text("DROP TABLE comments"))
                    await conn.execute(text(
                        "CREATE TABLE comments ("
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                        "entity_type VARCHAR(50) DEFAULT 'content', "
                        "entity_id INTEGER NOT NULL, "
                        "user_id INTEGER NOT NULL REFERENCES users(id), "
                        "parent_id INTEGER REFERENCES comments(id), "
                        "body TEXT NOT NULL, "
                        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
                        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                        ")"
                    ))
        except Exception as e:
            print(f"comments table recreation: {e}")
        # Taxonomy: add family column to entities + backfill from old categories
        for table in ["groups", "content", "events", "courses"]:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN family VARCHAR(50)"))
            except Exception:
                pass
        # Backfill family from known old category values
        for old_cat, new_family in CATEGORY_TO_FAMILY_MAP.items():
            for table in ["groups", "content", "events", "courses"]:
                try:
                    await conn.execute(text(
                        f"UPDATE {table} SET family = '{new_family}' WHERE family IS NULL AND category = '{old_cat}'"
                    ))
                except Exception:
                    pass
        # Seed taxonomy families (add missing ones, don't overwrite existing)
        try:
            for f in SEED_FAMILIES:
                existing = await conn.execute(text(f"SELECT id FROM taxonomy_families WHERE value = '{f['value']}'"))
                if not existing.scalar():
                    await conn.execute(text(
                        f"INSERT INTO taxonomy_families (value, label, label_pt, icon, sort_order, is_active, created_at, updated_at) "
                        f"VALUES ('{f['value']}', '{f['label']}', '{f['label_pt']}', '{f['icon']}', {f['sort_order']}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                    ))
            # Seed categories (add missing ones)
            for c in SEED_CATEGORIES:
                fam_result = await conn.execute(text(f"SELECT id FROM taxonomy_families WHERE value = '{c['family']}'"))
                fam_id = fam_result.scalar()
                if fam_id:
                    cat_existing = await conn.execute(text(
                        f"SELECT id FROM taxonomy_categories WHERE family_id = {fam_id} AND value = '{c['value']}'"
                    ))
                    if not cat_existing.scalar():
                        await conn.execute(text(
                            f"INSERT INTO taxonomy_categories (family_id, value, label, label_pt, sort_order, is_active, created_at, updated_at) "
                            f"VALUES ({fam_id}, '{c['value']}', '{c['label']}', '{c['label_pt']}', {c['sort_order']}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                        ))
        except Exception as e:
            print(f"taxonomy seed: {e}")
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

app.add_middleware(RateLimitMiddleware)

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
app.include_router(external.router)
app.include_router(images.router)
app.include_router(taxonomy.router)
app.include_router(marketplace.router)
app.include_router(payments.router)
app.include_router(waste.router)

# Serve uploaded media files
media_path = Path(settings.media_dir)
media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")


@app.get("/api/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "degraded", "database": "error", "detail": str(e)}
