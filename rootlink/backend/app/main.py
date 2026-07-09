import asyncio
import fcntl
import mimetypes
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api import (
    account,
    admin,
    articles,
    auth,
    auth_security,
    blocks,
    checklist,
    comments,
    content,
    content_templates,
    content_ui,
    copy,
    crawl,
    delegations,
    element_catalog,
    entities,
    entity_conversion,
    events,
    external,
    farmers_guide,
    feeds,
    groups,
    images,
    learning,
    legal,
    marketplace,
    messages,
    notifications,
    overrides,
    payments,
    permissions,
    plants,
    points,
    ratings,
    role_requests,
    self_publish,
    social,
    taxonomy,
    theme,
    theme_manager,
    users,
    waste,
)
from app.core.config import settings
from app.core.database import async_session_factory, engine
from app.core.logging import setup_logging
from app.core.rate_limit import RateLimitMiddleware
from app.models.auth_tokens import EmailVerificationToken, PasswordResetToken  # noqa: F401 - ensure table creation
from app.models.base import Base
from app.models.block_page import BlockPage, BlockSection  # noqa: F401 - ensure table creation
from app.models.element_schema import ElementSchema  # noqa: F401 - ensure table creation
from app.models.entity import DelegationGrant, Entity  # noqa: F401 - ensure table creation
from app.models.font import Font  # noqa: F401 - ensure table creation
from app.models.image_asset import ImageAsset  # noqa: F401 - ensure table creation
from app.models.override_log import OverrideLog  # noqa: F401 - ensure table creation
from app.models.page_draft import PageDraft  # noqa: F401 - ensure table creation
from app.models.role_request import RoleChangeRequest  # noqa: F401 - ensure table creation
from app.models.session import Session  # noqa: F401 - ensure table creation
from app.models.taxonomy import (  # noqa: F401
    CATEGORY_TO_FAMILY_MAP,
    SEED_CATEGORIES,
    SEED_FAMILIES,
    TaxonomyCategory,
    TaxonomyFamily,
)
from app.models.theme import Theme, ThemeToken  # noqa: F401 - ensure table creation
from app.models.theme_override import ThemeOverride  # noqa: F401 - ensure table creation
from app.services.element_catalog_seed import seed_default_element_catalog
from app.services.legal_seed import seed_legal_documents
from app.services.roles_migration import migrate_legacy_delegations, migrate_users_to_entity_rank
from app.services.template_seed import seed_content_templates
from app.services.theme_seed import seed_default_theme
from app.services.block_page_seed import seed_block_pages


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    # Serialize schema setup across uvicorn workers. Dockerfile.prod runs
    # `--workers 2`, and each process runs this lifespan; without this exclusive
    # lock, two workers race in create_all → "table X already exists" and a worker
    # crashes on startup (DEPLOY.md gotcha #7). All workers share the container FS,
    # so an flock on a temp file gates them. The second worker then finds every
    # table/column already present and its migrations no-op.
    _migrate_lock = open(os.path.join(tempfile.gettempdir(), "rootlink-migrate.lock"), "w")
    await asyncio.to_thread(fcntl.flock, _migrate_lock, fcntl.LOCK_EX)
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
        # Roles/permissions redesign — Phase 1 first slice. Rename the
        # organization sub-kind column (`entity_type`, added just above) to
        # `organization_kind` so it stops colliding with the new "entity"
        # concept introduced below (`entity_id`/`rank` on `users`, plus the
        # new `entities` table). Phase 0 decision (f):
        # docs/roles-permissions/phase0-decisions.md. Guarded/
        # idempotent: only runs if the old column is still present and the
        # new one isn't — a fresh DB's `create_all` above already creates
        # `organization_kind` directly (the model attribute is renamed too),
        # so this only fires once, on an existing dev DB, and no-ops on every
        # later restart or on a second racing worker.
        try:
            info = await conn.execute(text("PRAGMA table_info(users)"))
            user_cols = [r[1] for r in info.fetchall()]
            if "entity_type" in user_cols and "organization_kind" not in user_cols:
                await conn.execute(
                    text("ALTER TABLE users RENAME COLUMN entity_type TO organization_kind")
                )
        except Exception as e:
            print(f"users.entity_type -> organization_kind rename (skipped, will retry): {e}")
        # Roles/permissions redesign — Phase 1 first slice: `entity_id` (FK to
        # the new `entities` table) + `rank` (0-5, docs/roles-permissions/ROLES_PERMISSIONS.md §5) on User.
        # Purely additive — left null for every existing row; no migration of
        # existing users onto these fields yet (docs/roles-permissions/phase0-decisions.md (b) is
        # the recorded design for that future step). `role` is untouched and
        # remains authoritative until a later phase cuts enforcement over.
        for col, typedef in [
            ("entity_id", "INTEGER"),
            ("rank", "INTEGER"),
            ("entity_kind", "VARCHAR(20)"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Roles/permissions redesign — Phase 2: "Verified user" fields
        # (docs/roles-permissions/phase0-decisions.md (g)).
        for col, typedef in [
            ("email_verified", "BOOLEAN DEFAULT 0"),
            ("email_verified_at", "TIMESTAMP"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Roles/permissions redesign — Phase 4 (docs/roles-permissions/ROLES_PERMISSIONS.md §2 "Verified
        # professional", §3 entity conversion). See
        # app/services/entity_conversion.py's module docstring.
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN activity_registration_number VARCHAR(50)"))
        except Exception:
            pass
        # Roles/permissions redesign — Phase 4 (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity
        # dissolution" / entity-level ban, docs/roles-permissions/phase0-decisions.md addendum). The
        # `entities` table itself already exists (Phase 1) — these are new
        # columns on it, guarded the same way as every other lifespan ALTER.
        for col, typedef in [
            ("dissolution_requested_at", "TIMESTAMP"),
            ("dissolution_requested_by", "INTEGER"),
            ("dissolution_snapshot", "JSON"),
            ("banned_at", "TIMESTAMP"),
            ("ban_reason", "VARCHAR(500)"),
            ("banned_by", "INTEGER"),
            ("ban_cascade_grace_expires_at", "TIMESTAMP"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE entities ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Roles/permissions redesign — Phase 4 (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Cross-entity
        # ban cascade"). See app/services/entity_cascade.py's module
        # docstring for why these two columns (and not GroupMember) are the
        # real footprint mechanism today.
        for table in ("event_sponsors", "event_vendors"):
            for col, typedef in [
                ("contributing_entity_id", "INTEGER"),
                ("cascade_hidden_at", "TIMESTAMP"),
            ]:
                try:
                    await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}"))
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
        # Content platform Phase 1: `status` becomes the SINGLE visibility gate
        # (see docs/content-platform/CONTENT_PLATFORM.md §2). Migrate existing rows
        # so visibility is preserved exactly, then the app reads only `status`.
        try:
            await conn.execute(text("ALTER TABLE content ADD COLUMN review_note TEXT"))
        except Exception:
            pass
        # Roles/permissions UI backlog — real two-step article review/approve
        # (docs/roles-permissions/ROLES_PERMISSIONS.md §7). `review_comment` is
        # the internal-only note for the new "mark reviewed" step, distinct
        # from the author-facing `review_note`. `status` itself needs no
        # migration — it's a plain VARCHAR, and "reviewed" is just a new
        # allowed value, not a schema change.
        try:
            await conn.execute(text("ALTER TABLE content ADD COLUMN review_comment TEXT"))
        except Exception:
            pass
        # NOTE: authored vs crawled is discriminated by `url` (NULL for editor
        # articles, always set for crawled rows). We deliberately do NOT use
        # `body IS NULL`: SQLAlchemy's JSON column stores Python None as JSON
        # 'null', not SQL NULL, so that predicate never matches.
        # 1) Authored articles that were "published but unreviewed" (hidden under
        #    the old verification gate) -> in_review (still hidden, now in the queue).
        try:
            await conn.execute(text(
                "UPDATE content SET status='in_review' "
                "WHERE status='published' AND verification_status='unreviewed' AND url IS NULL"
            ))
        except Exception:
            pass
        # 2) Crawled rows that were published-but-unreviewed -> draft (hidden, not in
        #    the human queue; cross-reference will publish them when corroborated).
        try:
            await conn.execute(text(
                "UPDATE content SET status='draft' "
                "WHERE status='published' AND verification_status='unreviewed' AND url IS NOT NULL"
            ))
        except Exception:
            pass
        # 3) Everything corroborated/approved under the old gate -> published.
        try:
            await conn.execute(text(
                "UPDATE content SET status='published' "
                "WHERE verification_status IN ('community_reviewed','cross_referenced')"
            ))
        except Exception:
            pass
        # Content platform Phase 2: video poster on lessons (§6.5)
        try:
            await conn.execute(text("ALTER TABLE lessons ADD COLUMN poster VARCHAR(2000)"))
        except Exception:
            pass
        # Group soft-archive lifecycle
        for col, typedef in [
            ("status", "VARCHAR(20) DEFAULT 'active'"),
            ("archived_at", "TIMESTAMP"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE groups ADD COLUMN {col} {typedef}"))
            except Exception:
                pass
        # Legacy fix: older DBs created groups.category as NOT NULL, but the model is
        # nullable — creating a group with no category 500s. SQLite can't drop a
        # NOT NULL in place, so rebuild the table once (data preserved).
        #
        # Hardened: the whole rebuild runs inside a SAVEPOINT so a mid-way failure
        # rolls back to the ORIGINAL `groups` table (never a half-migrated / renamed
        # state). The nullability is re-checked inside the savepoint so a second
        # uvicorn worker (Dockerfile.prod runs --workers 2, each runs this lifespan)
        # or a later restart simply no-ops instead of racing.
        try:
            info = await conn.execute(text("PRAGMA table_info(groups)"))
            cat = next((r for r in info.fetchall() if r[1] == "category"), None)
            if cat is not None and cat[3] == 1:  # category currently NOT NULL
                async with conn.begin_nested():  # SAVEPOINT — atomic rebuild
                    # Re-check inside the savepoint (dodges the 2-worker race).
                    recheck = await conn.execute(text("PRAGMA table_info(groups)"))
                    rcat = next((r for r in recheck.fetchall() if r[1] == "category"), None)
                    if rcat is not None and rcat[3] == 1:
                        # Clear any orphan from a prior aborted run.
                        await conn.execute(text("DROP TABLE IF EXISTS groups_legacy"))
                        await conn.execute(text("ALTER TABLE groups RENAME TO groups_legacy"))
                        await conn.execute(text("DROP INDEX IF EXISTS ix_groups_slug"))
                        await conn.run_sync(Base.metadata.tables["groups"].create)
                        await conn.execute(text(
                            "INSERT INTO groups (id, name, slug, description, category, family, "
                            "created_by, image_url, status, archived_at, created_at, updated_at) "
                            "SELECT id, name, slug, description, category, family, created_by, "
                            "image_url, status, archived_at, created_at, updated_at FROM groups_legacy"
                        ))
                        await conn.execute(text("DROP TABLE groups_legacy"))
        except Exception as e:
            # Savepoint rolled back → original groups table is intact; retried next boot.
            print(f"groups category rebuild (skipped, will retry): {e}")
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
        # Content platform Phase 0: trust, editable-copy & enforcement-ladder fields
        # (see docs/content-platform/CONTENT_PLATFORM.md §3, §4.4, §12). The
        # enforcement-ladder columns (`account_status` et al.) are reused,
        # not replaced, by the roles/permissions redesign's own 4-rung ladder
        # (docs/roles-permissions/ROLES_PERMISSIONS.md §4) — see the
        # `AccountStatus.restricted` addition further down for where that
        # ladder's 4th rung was added onto this same column.
        for col, typedef in [
            ("can_self_publish", "BOOLEAN DEFAULT 0"),
            ("self_publish_agreed_at", "TIMESTAMP"),
            ("can_edit_copy", "BOOLEAN DEFAULT 0"),
            ("account_status", "VARCHAR(20) DEFAULT 'active'"),
            ("suspended_until", "TIMESTAMP"),
            ("banned_at", "TIMESTAMP"),
            ("ban_reason", "TEXT"),
            ("banned_by", "INTEGER"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
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
        # Event soft-archive lifecycle (mirrors the groups archived_at column;
        # events.status already exists from the Event Manager migrations above)
        try:
            await conn.execute(text("ALTER TABLE events ADD COLUMN archived_at TIMESTAMP"))
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
    # Seed starter long-form templates (idempotent) — CONTENT_PLATFORM.md §5.4
    try:
        async with async_session_factory() as session:
            await seed_content_templates(session)
    except Exception as e:
        print(f"template seed: {e}")
    # Seed the 3 legal documents (Privacidade/Termos/Legal) — idempotent, admin-editable
    try:
        async with async_session_factory() as session:
            await seed_legal_documents(session)
    except Exception as e:
        print(f"legal document seed: {e}")
    # Seed the Content Studio default theme + its named tokens (CONTENT_STUDIO.md
    # §8/§9) — idempotent. The themes/theme_tokens tables are created by the
    # create_all above (the models are imported up top for that purpose).
    try:
        async with async_session_factory() as session:
            await seed_default_theme(session)
    except Exception as e:
        print(f"theme seed: {e}")
    # Seed the Content Studio default element schemas + fonts
    # (CONTENT_STUDIO.md §5 element catalog, §3.1 font library) — idempotent.
    # The element_schemas/fonts tables are created by the create_all above
    # (the models are imported up top for that purpose).
    try:
        async with async_session_factory() as session:
            await seed_default_element_catalog(session)
    except Exception as e:
        print(f"element catalog seed: {e}")
    # Seed the Content Studio block pages (home, donate, etc.) — idempotent.
    # The block_pages/block_sections tables are created by the create_all above.
    try:
        async with async_session_factory() as session:
            await seed_block_pages(session)
    except Exception as e:
        print(f"block page seed: {e}")
    # Roles/permissions redesign — Phase 1 data migration (idempotent; only
    # processes rows not yet migrated). See
    # docs/roles-permissions/phase0-decisions.md (b) for the mapping
    # rules and app/services/roles_migration.py for the implementation.
    try:
        async with async_session_factory() as session:
            entity_rank_stats = await migrate_users_to_entity_rank(session)
            if entity_rank_stats["migrated"]:
                print(f"roles migration (entity/rank backfill): {entity_rank_stats}")
    except Exception as e:
        print(f"roles migration (entity/rank backfill) failed: {e}")
    try:
        async with async_session_factory() as session:
            delegation_stats = await migrate_legacy_delegations(session)
            if delegation_stats["self_publish_grants_created"] or delegation_stats["edit_copy_grants_created"]:
                print(f"roles migration (legacy delegation backfill): {delegation_stats}")
    except Exception as e:
        print(f"roles migration (legacy delegation backfill) failed: {e}")
    fcntl.flock(_migrate_lock, fcntl.LOCK_UN)
    _migrate_lock.close()
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
app.include_router(auth_security.router)
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
app.include_router(articles.router)
app.include_router(ratings.router)
app.include_router(points.router)
app.include_router(feeds.router)
app.include_router(content_templates.router)
app.include_router(self_publish.router)
app.include_router(account.router)
app.include_router(copy.router)
app.include_router(content_ui.router)
app.include_router(theme.router)
app.include_router(theme_manager.router)
app.include_router(element_catalog.router)
app.include_router(overrides.router)
app.include_router(blocks.router)
app.include_router(legal.router)
app.include_router(permissions.router)
app.include_router(entity_conversion.router)
app.include_router(entities.router)
app.include_router(role_requests.router)
app.include_router(delegations.router)

# Serve uploaded media files.
# Register image MIME types explicitly: the slim Docker image's mimetypes DB does
# not know .webp, so StaticFiles would otherwise serve uploaded images as
# text/plain and browsers refuse to render them (editor image upload hangs).
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/avif", ".avif")
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
