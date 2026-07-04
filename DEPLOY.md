# RootLink Deployment Guide

> **Single source of truth for deploying RootLink.** Read this before any deploy task.
> If anything here changes (server, domains, secrets, process, gotchas), UPDATE THIS FILE
> in the same change. AGENTS.md instructs every agent to keep this current.
>
> Last verified working: 2026-07-02

---

## TL;DR — How to deploy

```bash
# 1. Commit your changes locally on `main`
git add -A && git commit -m "..."

# 2. Run the automated backend deploy (also pushes to GitHub → triggers Vercel frontend)
./scripts/deploy.sh
```

That's it. `scripts/deploy.sh` pushes to GitHub, SSHes to the server, backs up the DB,
pulls, rebuilds containers, runs migrations, and health-checks. Frontend auto-deploys on
Vercel from the same push.

If you only changed frontend code, you can just `git push origin main` and let Vercel
deploy — but running `./scripts/deploy.sh` is always safe (backend steps are idempotent).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Vercel (auto-deploy on push to `main`)                         │
│  rootlink.ruisilvastudio.com → Frontend (Next.js 14)           │
│  Root Directory = rootlink/frontend  (set in Vercel dashboard)  │
│  Env: NEXT_PUBLIC_API_URL = https://api.ruisilvastudio.com      │
└─────────────────────────────────────────────────────────────────┘
                              │  https://api.ruisilvastudio.com
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare (CDN/proxy in front of api.ruisilvastudio.com)      │
│  Caches /media/* responses (~4h, max-age=14400).               │
│  ⚠ After any media Content-Type / header fix you MUST purge the │
│    Cloudflare cache (or wait out the TTL) — see gotcha #10.      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Home server 192.168.1.228 (Ubuntu)                             │
│  Caddy (80/443) → TLS termination + reverse proxy               │
│    ├─ api.ruisilvastudio.com    → localhost:8000  (RootLink)   │
│    └─ media.ruisilvastudio.com  → localhost:8096  (Jellyfin)   │
│                                                                 │
│  Docker Compose (rootlink/docker-compose.prod.yml):            │
│    ├─ backend       FastAPI + uvicorn (2 workers), SQLite      │
│    ├─ redis         Redis 7 (AOF persistence)                  │
│    ├─ celery-worker background tasks                           │
│    └─ celery-beat   task scheduler                             │
│                                                                 │
│  Volumes:                                                      │
│    ./backend-data:/app/data   (SQLite DB + media + backups)    │
│    ./redis-data:/data         (Redis persistence)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Access & locations

| Thing | Value |
|---|---|
| SSH | `ssh rui@192.168.1.228` (password: `R71977ui`; key-based also works) |
| Repo on server | `/home/rui/RootLink` |
| Compose dir on server | `/home/rui/RootLink/rootlink` |
| Compose file | `docker-compose.prod.yml` |
| GitHub | `github.com/RuiSilvaStudio/RootLink` (deploy branch: `main`) |
| Docker command | **`docker compose`** (v2, space — NOT `docker-compose`) |

## Domain → service

| Domain | Routes to | Service |
|---|---|---|
| `rootlink.ruisilvastudio.com` | Vercel | Frontend |
| `api.ruisilvastudio.com` | `:8000` | RootLink backend |
| `media.ruisilvastudio.com` | `:8096` | Jellyfin (separate app — do not touch) |

---

## Environment variables (server)

File: `/home/rui/RootLink/rootlink/.env` (git-ignored, lives only on the server).
`docker-compose.prod.yml` reads these.

```bash
SECRET_KEY=<random 64-hex>
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://rootlink.ruisilvastudio.com
MEDIA_URL=https://api.ruisilvastudio.com
STRIPE_SECRET_KEY=sk_test_...        # or sk_live_ in production
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
LIBERAPAY_WEBHOOK_SECRET=            # empty until Liberapay is wired
```

**Vercel env (dashboard → Settings → Environment Variables):**
- `NEXT_PUBLIC_API_URL = https://api.ruisilvastudio.com` (NOT sensitive — it's public)

---

## Stripe setup (donations / point economy)

- Keys live in the server `.env` (above). Get them from
  https://dashboard.stripe.com/test/apikeys
- **Webhook** (required for points to be credited after a donation):
  - Endpoint URL: `https://api.ruisilvastudio.com/api/points/webhooks/stripe`
  - Event: `checkout.session.completed`
  - Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`, then
    restart: `docker compose -f docker-compose.prod.yml up -d backend celery-worker celery-beat`
- Test card: `4242 4242 4242 4242`, any future expiry, any CVC.
- **GOTCHA:** Stripe checkout `success_url`/`cancel_url` must point to the real domain
  (`https://rootlink.ruisilvastudio.com/...`), not `localhost`. This is hardcoded in
  `app/api/points.py`. Checkout sessions also expire quickly — generate and use immediately.

---

## Database

- **Type:** SQLite at `/home/rui/RootLink/rootlink/backend-data/rootlink.db`
- **Backups:** `backend-data/backups/` — `deploy.sh` makes a timestamped copy before every
  deploy and keeps the last 20.
- **Migrations — TWO mechanisms (know this):**
  1. **App lifespan** (`app/main.py`): on startup it runs `Base.metadata.create_all`
     (new tables) + idempotent `ALTER TABLE` / data backfills. This is the de-facto
     schema path and applies the **content-platform** additions below. Because
     `Dockerfile.prod` runs `uvicorn --workers 2`, the whole migration block is wrapped
     in an **flock** (`/tmp/rootlink-migrate.lock`) so the two workers don't race in
     `create_all` ("table X already exists" → worker crash). The `groups.category`
     rebuild runs inside a SAVEPOINT (crash-safe: a failure leaves the original table
     intact).
  2. **Alembic** (`alembic upgrade head`, run by `deploy.sh`): currently a no-op for the
     content-platform changes (no new revisions were added this round). Head is still
     `8a1b2c3d4e5f`. TODO: backfill Alembic revisions so the documented path matches reality.
- **Content-platform schema added (applied via lifespan):** new tables
  `moderation_audit_log`, `content_templates`, `copy_overrides`; new columns on `users`
  (`role` gains `super_admin`, `account_status`, `suspended_until`, `banned_at`,
  `ban_reason`, `banned_by`, `can_self_publish`, `self_publish_agreed_at`, `can_edit_copy`),
  `content` (`review_note`; `status` gains in_review/needs_changes/rejected; visibility gate
  moved from `verification_status` → `status`), `lessons` (`poster`), `groups`
  (`status`, `archived_at`, `category` made nullable via one-time table rebuild).
  **Verified via a prod-DB-copy dry-run before deploy** (data invariant preserved, both
  workers start clean, alembic no-op).
- **Legal documents feature (2026-07-02):** new table `legal_documents` (Privacidade/Termos/Legal,
  draft/publish workflow, super_admin only — see `app/api/legal.py`, `app/services/legal_seed.py`).
  Seeded idempotently on startup as **unpublished drafts** (`published_snapshot`/`published_at`
  stay `NULL`, `changelog` starts empty) — `GET /api/legal/{slug}` 404s and the public pages show
  the "draft, not reviewed" banner until a super_admin explicitly publishes from `/admin/legal`.
  **Gotcha:** the seed is startup-idempotent (only inserts a row if its `slug` is missing), so if
  you ever change what "freshly seeded" should look like, editing `legal_seed.py` alone does
  nothing for rows already in the DB — you must also delete the existing row(s)
  (`docker compose exec backend python3 -c "..."` against `/app/data/rootlink.db`) and restart the
  backend to re-trigger the seed. Hit this the same day the feature shipped: the first version of
  the seed pre-published the initial content, which had to be corrected and the already-seeded
  prod rows manually cleared.

### Admin user management
Use `scripts/reset_admin.py` (see `scripts/README.md`). To run against PROD, exec inside
the backend container so it uses the production DB:
```bash
ssh rui@192.168.1.228
cd /home/rui/RootLink/rootlink
docker compose -f docker-compose.prod.yml exec backend python /app/scripts/reset_admin.py --list
```
(Existing admin created during setup: `admin@rootlink.org`.)

---

## Background tasks (Celery)

Scheduled by `celery-beat`, run by `celery-worker`, brokered through `redis`.
- Point decay — daily 00:00 UTC
- RSS crawl priority 1 — every 15 min
- RSS crawl priority 2 — hourly
- RSS crawl priority 3 — every 6 h
- Draft cleanup — monthly, 1st @ 02:00 UTC

**GOTCHA:** Celery connects to Redis via the Docker service hostname `redis:6379`
(see `REDIS_URL` in `app/tasks/celery_app.py`) — NOT `localhost`. localhost only works
inside a single container.

---

## Monitoring

```bash
ssh rui@192.168.1.228
docker ps                                            # all 4 containers Up?
curl https://api.ruisilvastudio.com/api/health       # {"status":"ok",...}
docker logs rootlink-backend-1 --tail 30
docker logs rootlink-celery-worker-1 --tail 20       # should say "Connected to redis://redis:6379"
docker logs rootlink-celery-beat-1 --tail 10
docker exec rootlink-redis-1 redis-cli ping          # PONG
```

---

## Rollback

```bash
ssh rui@192.168.1.228
cd /home/rui/RootLink/rootlink
# Restore most recent DB backup:
cp "$(ls -1t backend-data/backups/rootlink.db.backup.* | head -1)" backend-data/rootlink.db
docker compose -f docker-compose.prod.yml restart backend celery-worker celery-beat
# Code rollback: git checkout <good-sha> then docker compose ... up -d --build
```

---

## Known constraints & hard-won gotchas

These cost real time. Read before debugging.

1. **`docker compose` not `docker-compose`** — the server has Compose v2 (space form).
2. **Vercel Root Directory must be `rootlink/frontend`** (set in dashboard → Settings →
   Build and Deployment). Do NOT rely on a `vercel.json` `rootDirectory` — it conflicted
   and caused `cd: rootlink/frontend: No such file or directory`. There is intentionally
   NO `vercel.json` in the repo.
3. **Stale local `.next` cache** breaks the dev server with 404s on `/_next/static/*`
   (page renders with no CSS/JS, looks "unformatted"). Fix: `npm run dev:restart` (or
   `rm -rf .next .next-build && next dev`). This is a LOCAL dev issue, not production.
4. **Stripe URLs** must be the real domain, not localhost (see Stripe section).
5. **Celery → Redis** uses hostname `redis`, not localhost (see Celery section).
6. **Jellyfin media** lives at `/mnt/media` (group `jellyfin`). RootLink media lives at
   `backend-data/media`. Completely separate — never point RootLink at `/mnt` or `/media`.
7. **First-time schema on a DB created by `Base.metadata.create_all`**: tables may already
   exist when Alembic runs, causing "table already exists". If that happens, stamp instead:
   `alembic stamp head`. Then verify with `alembic current` (should be `d73cb2cb00bf (head)`)
   and that `alembic upgrade head` is a no-op. (This was resolved; prod schema == head.)
   **Also:** `--workers 2` means two processes run the lifespan `create_all` concurrently —
   introducing NEW tables would race ("table X already exists" → a worker exits on startup).
   This is now prevented by an flock around the migration block (see Database §). If you add
   more new tables via the lifespan, that lock keeps the workers from racing.
8. **`requirements-prod.txt` must include** alembic, feedparser, celery[redis], redis —
   otherwise the Celery containers fail with "executable file not found: celery".
9. **`npm audit` shows Next.js 14 CVEs** — do NOT `npm audit fix --force` (jumps to Next 16
   and breaks the app). These are tracked in `TECH_DEBT.md` for the planned Next 15 upgrade.
9a. **ALWAYS run `npm run build` (next build) locally before a frontend deploy.** `tsc --noEmit`
    and `next lint` do NOT catch prerender/SSG errors. In particular, `useSearchParams()` in a
    statically-prerendered page throws "should be wrapped in a suspense boundary" and **fails the
    Vercel build** (the live site then silently stays on the previous build). Fix: read the query
    via `new URLSearchParams(window.location.search)` in an effect, or wrap the component in
    `<Suspense>`, or mark the route dynamic. This cost a failed deploy on 2026-06-29
    (`/events`, `/groups`). If you must avoid `next build` clobbering a running `next dev` `.next`,
    stop dev → build → `npm run dev:restart`.
10. **`.webp` MIME type + Cloudflare cache** (cost real time — 2026-06-27). Uploaded images are
    normalized to **webp**. The slim Docker image's `mimetypes` DB does NOT know `.webp`, so
    Starlette `StaticFiles` served them as `Content-Type: text/plain` → browsers refuse to render
    them → the article editor's image upload spinner hangs forever (worked locally only because the
    host mimetypes knows webp). Fixed in `backend/app/main.py` with
    `mimetypes.add_type("image/webp", ".webp")` **before** mounting `/media`. Do NOT remove this.
    **Cloudflare** sits in front of `api.ruisilvastudio.com` and cached the bad `text/plain`
    responses for ~4h (`cf-cache-status: HIT`, `max-age=14400`). After ANY media Content-Type/header
    fix: **purge the Cloudflare cache** (dashboard → Caching → Configuration → Purge Everything, or
    purge by prefix `https://api.ruisilvastudio.com/media/`) or wait out the TTL. New uploads get a
    fresh hash-based URL (cache MISS) so they render immediately; only already-cached URLs are stale.
    There is no Cloudflare API token on the server — purge is a manual dashboard action.
11. **The server's checked-out repo branch is literally named `feature/event-manager-and-fixes`,
    not `main`** (confirmed 2026-07-04, roles/permissions redesign deploy pre-flight check) —
    `git branch -vv` on the server shows this branch tracking its own same-named `origin` branch,
    63 commits ahead of *that* remote branch, while content-wise it's a strict ancestor of
    `origin/main` (0 unique commits). This is harmless *in practice* because `deploy.sh` runs
    `git pull origin main` explicitly (not a plain `git pull`), which fetches `origin/main` and
    fast-forwards whatever is checked out, regardless of its name — but it means the server is
    NOT actually "on `main`" the way the architecture diagram implies, and if this branch ever
    picks up local-only commits (making the pull a real merge instead of a fast-forward), the
    result would be a merge commit on a branch with a stale/confusing name, not `main`. Checked via
    `git rev-list --left-right --count HEAD...origin/main` before every deploy if you want to
    confirm it's still a clean fast-forward. Not fixed as part of this deploy (pre-existing,
    orthogonal risk, would need to be a deliberate `git checkout main` on the server done outside
    a deploy window) — flagged here so a future session doesn't assume the server is on a branch
    literally called `main`.
12. **Celery never actually runs any background job in prod** — see `docs/LESSONS.md` #36
    (`autodiscover_tasks(["app.tasks"])` registers zero tasks; found live 2026-07-04 while
    verifying the roles/permissions deploy). Point decay / RSS crawl / draft cleanup have likely
    silently no-op'd since Celery was introduced. Not caused by, or fixed as part of, the
    roles/permissions deploy — needs its own fix + verification pass.

---

## After deploying — verify

```bash
# Backend
curl https://api.ruisilvastudio.com/api/health
# Frontend (a few key routes should all be 200)
for p in / /search /articles/my /donate /leaderboard; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' https://rootlink.ruisilvastudio.com$p)  $p"
done
```

---

## Keep this current + keep the graph current

- **DEPLOY.md:** Any change to server, domains, secrets, process, or a new gotcha → edit
  this file in the same commit.
- **Graphify:** After code changes run `graphify update .` (bare CLI, code-only, no LLM) to
  refresh the knowledge graph. This is safe — it preserves existing community names in
  `graphify-out/.graphify_labels.json` (remaps by node overlap), only new communities get a
  placeholder. **Never** run a full `/graphify` rebuild (the skill pipeline) without immediately
  completing its Step 5 (semantic community labeling) — that step unconditionally resets every
  community to a placeholder name ("Community 0", "Community 1", ...) and only Step 5 restores
  real names. Skipping it silently leaves the whole graph mislabeled. See `docs/LESSONS.md` #25.

## Future improvements
- [x] Automated deploy script (`scripts/deploy.sh`)
- [x] DB backup before deploy (built into deploy.sh, keeps last 20)
- [ ] CI/CD (GitHub Actions) instead of manual `deploy.sh`
- [ ] Monitoring/alerting (Prometheus + Grafana / uptime ping)
- [ ] Next.js 15 upgrade (clears Next 14 CVEs + unlocks ESLint 9) — see TECH_DEBT.md
