# RootLink Deployment Guide

> Last updated: 2026-2027

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Vercel (auto-deploy on push to main)                           │
│  rootlink.ruisilvastudio.com → Frontend (Next.js 14)           │
─────────────────────────────────────────────────────────────────┘
                              │
                              │ https://api.ruisilvastudio.com
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Local Server 192.168.1.228 (Ubuntu)                            │
│  Caddy (ports 80/443) → TLS termination                         │
│    ├─ api.ruisilvastudio.com     → :8000 (Backend Docker)      │
│    └─ media.ruisilvastudio.com   → :8096 (Jellyfin)            │
│                                                                 │
│  Docker Compose (docker-compose.prod.yml):                     │
│    ├─ backend      — FastAPI + uvicorn (2 workers), SQLite     │
│    ├─ redis        — Redis 7 (persistent, AOF)                 │
│    ├─ celery-worker — Background task processor                │
│    └─ celery-beat   — Task scheduler                           │
│                                                                 │
│  Volumes:                                                      │
│    ├─ ./backend-data:/app/data  (SQLite DB + media)            │
│    └─ ./redis-data:/data        (Redis persistence)            │
└─────────────────────────────────────────────────────────────────┘
```

## Server Access

- **SSH**: `ssh rui@192.168.1.228`
- **Password**: `R71977ui`
- **Git repo**: `/home/rui/RootLink/`
- **Docker compose**: `/home/rui/RootLink/rootlink/docker-compose.prod.yml`

## Domain → Service Mapping

| Domain | Port | Service |
|--------|------|---------|
| `rootlink.ruisilvastudio.com` | 443 → Vercel | Frontend |
| `api.ruisilvastudio.com` | 443 → 8000 | Backend API |
| `media.ruisilvastudio.com` | 443 → 8096 | Jellyfin (separate) |

## Deployment Process

### Manual Deploy (recommended)

```bash
# From local machine:
git add -A && git commit -m "your message"
git push origin main

# Vercel auto-deploys frontend

# SSH to server and deploy backend:
ssh rui@192.168.1.228
cd /home/rui/RootLink/rootlink
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Deploy Script (future automation)

```bash
#!/bin/bash
# deploy.sh - to be created
# 1. SSH to server
# 2. Backup database
# 3. Pull code
# 4. Build and restart
# 5. Run migrations
# 6. Health check
```

## Environment Variables

Set in `/home/rui/RootLink/rootlink/.env` on server:

```bash
SECRET_KEY=your-production-secret-key
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://rootlink.ruisilvastudio.com
MEDIA_URL=https://api.ruisilvastudio.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
LIBERAPAY_WEBHOOK_SECRET=  # (when ready)
```

## Database

- **Type**: SQLite
- **Location**: `/home/rui/RootLink/rootlink/backend-data/rootlink.db`
- **Backups**: `/home/rui/RootLink/rootlink/backend-data/backups/`
- **Migrations**: Alembic (`alembic upgrade head`)

## Background Tasks (Celery)

- **Point decay**: Daily at 00:00 UTC
- **RSS crawl priority 1**: Every 15 minutes
- **RSS crawl priority 2**: Every hour
- **RSS crawl priority 3**: Every 6 hours
- **Draft cleanup**: Monthly on 1st at 02:00 UTC

## Monitoring

```bash
# Check all services
docker ps

# Check backend health
curl https://api.ruisilvastudio.com/api/health

# Check Celery worker
docker logs rootlink-celery-worker-1 --tail 20

# Check Celery beat
docker logs rootlink-celery-beat-1 --tail 20

# Check Redis
docker exec rootlink-redis-1 redis-cli ping
```

## Rollback

```bash
# If migration fails, restore from backup:
cp /home/rui/RootLink/rootlink/backend-data/backups/rootlink.db.backup.* /home/rui/RootLink/rootlink/backend-data/rootlink.db
docker compose -f docker-compose.prod.yml restart backend
```

## Known Constraints

- **Jellyfin media**: Lives at `/mnt/media` — do NOT use `/mnt` for RootLink media
- **RootLink media**: Lives at `/home/rui/RootLink/rootlink/backend-data/media`
- **No conflict**: Completely separate paths

## Future Improvements

- [ ] Automated deploy script with health checks
- [ ] Database backup cron job
- [ ] SSL certificate auto-renewal (Caddy handles this)
- [ ] Monitoring/alerting (Prometheus + Grafana)
- [ ] Load testing before major releases
