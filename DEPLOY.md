# RootLink Deployment Guide

> **Single source of truth for deploying RootLink.** Read this before any deploy task.
> If anything here changes (server, domains, secrets, process, gotchas), UPDATE THIS FILE
> in the same change. AGENTS.md instructs every agent to keep this current.
>
> Last verified working: 2026-06-27

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
- **Migrations:** Alembic. `alembic upgrade head` (run automatically by `deploy.sh`).
- **Current head revision:** `d73cb2cb00bf` (content evolution: points, ratings, feeds).

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
8. **`requirements-prod.txt` must include** alembic, feedparser, celery[redis], redis —
   otherwise the Celery containers fail with "executable file not found: celery".
9. **`npm audit` shows Next.js 14 CVEs** — do NOT `npm audit fix --force` (jumps to Next 16
   and breaks the app). These are tracked in `TECH_DEBT.md` for the planned Next 15 upgrade.

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
- **Graphify:** After code changes run `graphify update .` to refresh the knowledge graph.

## Future improvements
- [x] Automated deploy script (`scripts/deploy.sh`)
- [x] DB backup before deploy (built into deploy.sh, keeps last 20)
- [ ] CI/CD (GitHub Actions) instead of manual `deploy.sh`
- [ ] Monitoring/alerting (Prometheus + Grafana / uptime ping)
- [ ] Next.js 15 upgrade (clears Next 14 CVEs + unlocks ESLint 9) — see TECH_DEBT.md
