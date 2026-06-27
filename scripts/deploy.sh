#!/usr/bin/env bash
#
# deploy.sh — Automated RootLink backend deployment to the production server.
#
# Frontend deploys automatically on Vercel when you push to `main`.
# This script handles the BACKEND (FastAPI + Redis + Celery on 192.168.1.228).
#
# What it does, in order:
#   1. Pushes local main to GitHub (so the server can pull it)
#   2. SSHes to the server
#   3. Backs up the SQLite DB (timestamped) before any change
#   4. Pulls latest code
#   5. Rebuilds + restarts all containers (backend, redis, celery-worker, celery-beat)
#   6. Runs `alembic upgrade head` (safe no-op if already current)
#   7. Health-checks the API and prints container status
#
# Usage:
#   ./scripts/deploy.sh                 # full deploy (push + server update)
#   ./scripts/deploy.sh --no-push       # skip git push (server pulls whatever is on origin/main)
#   ./scripts/deploy.sh --backend-only  # alias for the default backend deploy (kept for clarity)
#
# Requirements: passwordless or key-based SSH to rui@192.168.1.228 (see DEPLOY.md).
#
# IMPORTANT: After ANY change to the deployment process, server, domains, secrets,
# or this script — UPDATE DEPLOY.md. The AGENTS.md instructs every agent to keep it current.

set -euo pipefail

SERVER="rui@192.168.1.228"
REMOTE_REPO="/home/rui/RootLink"
REMOTE_COMPOSE_DIR="/home/rui/RootLink/rootlink"
COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_URL="https://api.ruisilvastudio.com/api/health"
BRANCH="main"

DO_PUSH=true
for arg in "$@"; do
  case "$arg" in
    --no-push) DO_PUSH=false ;;
    --backend-only) ;; # default behaviour; flag kept for readability
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

say() { printf "\n\033[1;36m=== %s ===\033[0m\n" "$1"; }
ok()  { printf "\033[1;32m[OK] %s\033[0m\n" "$1"; }
err() { printf "\033[1;31m[ERROR] %s\033[0m\n" "$1" >&2; }

# 0. Confirm we're on main locally
LOCAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$LOCAL_BRANCH" != "$BRANCH" ]; then
  err "You are on '$LOCAL_BRANCH', not '$BRANCH'. Switch to $BRANCH before deploying."
  exit 1
fi

# 1. Push to GitHub (triggers Vercel frontend deploy too)
if [ "$DO_PUSH" = true ]; then
  say "Pushing $BRANCH to GitHub (also triggers Vercel frontend deploy)"
  git push origin "$BRANCH"
  ok "Pushed"
else
  say "Skipping git push (--no-push); server will pull current origin/$BRANCH"
fi

# 2-7. Everything on the server, in one SSH session
say "Deploying backend on $SERVER"
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$SERVER" bash -s <<REMOTE
set -euo pipefail

cd "$REMOTE_REPO"

echo "--- Backing up SQLite database ---"
mkdir -p "$REMOTE_COMPOSE_DIR/backend-data/backups"
if [ -f "$REMOTE_COMPOSE_DIR/backend-data/rootlink.db" ]; then
  cp "$REMOTE_COMPOSE_DIR/backend-data/rootlink.db" \
     "$REMOTE_COMPOSE_DIR/backend-data/backups/rootlink.db.backup.\$(date +%Y%m%d_%H%M%S)"
  echo "Backup created."
  # Keep only the 20 most recent backups
  ls -1t "$REMOTE_COMPOSE_DIR/backend-data/backups"/rootlink.db.backup.* 2>/dev/null \
    | tail -n +21 | xargs -r rm -f
else
  echo "No existing DB to back up (first deploy?)."
fi

echo "--- Pulling latest code ---"
git pull origin $BRANCH

echo "--- Rebuilding and restarting containers ---"
cd "$REMOTE_COMPOSE_DIR"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "--- Waiting for backend to come up ---"
sleep 12

echo "--- Running database migrations (no-op if current) ---"
docker compose -f "$COMPOSE_FILE" exec -T backend alembic upgrade head 2>&1 | grep -v "warning" || true

echo "--- Container status ---"
docker ps --format 'table {{.Names}}\t{{.Status}}'
REMOTE

# 8. Health check from local side
say "Health check"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo 000)"
if [ "$HTTP_CODE" = "200" ]; then
  ok "Backend healthy ($HEALTH_URL → 200)"
else
  err "Backend health check returned $HTTP_CODE — investigate (docker logs rootlink-backend-1)"
  exit 1
fi

say "Deploy complete"
echo "Frontend (Vercel) deploys from the GitHub push above — check the Vercel dashboard."
echo "Reminder: if anything about the process changed, update DEPLOY.md."
