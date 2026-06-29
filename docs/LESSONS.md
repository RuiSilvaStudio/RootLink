# Lessons Learned — read before dev/deploy work

> Hard-won, non-obvious lessons from real sessions. Each one cost time or caused a
> visible bug/failed deploy. Keep this current: when a new gotcha bites, add it here.
> Deployment-specific details live in `DEPLOY.md`; this file is the cross-cutting digest.

---

## Frontend (Next.js 14, App Router)

1. **Always run `npm run build` before a frontend deploy.** `tsc --noEmit` and `next lint`
   do **not** catch prerender/SSG errors. The classic: `useSearchParams()` in a statically
   prerendered page throws "should be wrapped in a suspense boundary" and **fails the Vercel
   build** — and the live site then silently stays on the *previous* build. Fixes: read the
   query via `new URLSearchParams(window.location.search)` in an effect, wrap in `<Suspense>`,
   or mark the route dynamic. (Cost a failed prod deploy: 2026-06-29, `/events` & `/groups`.)

2. **NEVER run `npm run build` while `next dev` is running.** They share `.next/`; the build
   clobbers the dev server's webpack chunks → `Cannot find module './NNNN.js'` → 500s / pages
   render with no CSS ("lost formatting"). To verify a build without disrupting dev: stop dev →
   `npm run build` → `npm run dev:restart` (which does `rm -rf .next && next dev`).

3. **`safeImageUrl` (`lib/image-url.ts`) blocks private hosts** (localhost/127/192.168/…) to avoid
   Firefox's local-network prompt on prod. Uploaded media is absolute `http://localhost:8001/...`
   in dev, so it would collapse to the placeholder — the helper now trusts the `NEXT_PUBLIC_API_URL`
   origin. If cards show placeholders but the detail/hero shows the image, suspect this.

4. **Next App Router has no route-change event** for guarding unsaved changes. `beforeunload` only
   covers refresh/close. To guard in-app `<Link>` clicks (e.g. the nav logo), intercept clicks in
   the capture phase (see `lib/use-dirty-guard.ts`).

## Backend (FastAPI + SQLAlchemy async + SQLite)

5. **Restart the backend after backend changes.** Dev uvicorn runs **without `--reload`**; new
   endpoints/migrations/seeds don't apply until restart. Symptoms: new endpoints 404, seeded data
   empty. (Prod containers re-run the lifespan on `up -d --build`.)

6. **Multi-worker lifespan migrations race.** `Dockerfile.prod` runs `uvicorn --workers 2`; each
   process runs the lifespan, so concurrent `create_all` on *new* tables → "table X already exists"
   → a worker crashes on startup. Serialize the whole migration block with an `flock`
   (`/tmp/rootlink-migrate.lock`) — workers share the container FS. (See `app/main.py`.)

7. **SQLite can't drop `NOT NULL` in place** — rebuild the table (rename → create-from-model →
   copy → drop). Do it inside a **SAVEPOINT** (`conn.begin_nested()`) so a mid-way failure rolls
   back to the intact original (never a half-renamed state), re-check the condition inside (worker
   race), and drop any stale `*_legacy` first. Test the rebuild on a **copy of the real DB**.

8. **A SQLAlchemy `JSON` column stores Python `None` as JSON `null`, not SQL `NULL`.** So
   `WHERE json_col IS NULL` never matches. Key migration logic on a `String`/`Text` column instead
   (we used `url IS NULL` to tell authored vs crawled content apart).

9. **Backend graceful shutdown hangs on open SSE streams.** If a restart stalls, the old uvicorn is
   waiting for notification streams to close → `kill -9` the pid, confirm the port is free
   (`ss -ltnp | grep :8001`), then start fresh.

10. **Two migration mechanisms coexist** (intentionally, for now): the app **lifespan**
    (`create_all` + idempotent `ALTER`/backfills) is the de-facto schema path; **Alembic**
    (`alembic upgrade head` in `deploy.sh`) currently has no revisions for the content-platform
    schema (it's a no-op). TODO: reconcile by backfilling Alembic revisions. Until then, schema
    changes go in the lifespan (idempotent, guarded, and now flock-serialized).

## Shell / ops

11. **`pkill -f "<pattern>"` can kill your own shell** because the pattern matches your running
    command line (which contains the pattern). Kill by **PID** instead, or use a pattern that can't
    match the command you're typing.

12. **Background long-running servers:** launch with `setsid nohup … > log 2>&1 < /dev/null &`,
    then poll a log/health endpoint in a *separate* command — the launching command otherwise hangs
    on the child's fds until the tool times out.

## Process / working style (what worked)

13. **When the user won't manually test each step, stand up a test harness first** and make
    correctness *provable*. The backend `pytest` harness (in-memory SQLite + ASGI client + user
    factory, `tests/conftest.py`) caught real bugs (the JSON-null gotcha, the data-visibility
    invariant) before they shipped.

14. **Build in small, independently-verified increments**, lint + test each, and keep
    `docs/content-platform/IMPLEMENTATION_STATUS.md` current so any session can resume cold.

15. **Dry-run schema/data migrations against a COPY of the real prod DB using the prod Docker
    image** before deploying. This is the only thing that catches issues bare-localhost can't
    (the 2-worker race, real data shape). `deploy.sh` also backs up the prod DB before every run.
