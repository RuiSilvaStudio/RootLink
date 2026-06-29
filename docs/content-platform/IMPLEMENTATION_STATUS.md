# Content Platform — Implementation Status & Handoff

> **Last updated:** 2026-06-28 (end of session)
> **Purpose:** Durable record of progress so work can resume later with zero context loss.
> **Spec:** [`CONTENT_PLATFORM.md`](./CONTENT_PLATFORM.md) · **Mockups:** [`mockups/`](./mockups/)

---

## TL;DR — where we are

The core content platform is **implemented and tested end-to-end** (backend Phases 0–6 + the main frontend layer). The user is now doing **manual QA** and **collecting a list of issues** (several found; some already fixed below — see "Issues found in QA"). We **paused mid-QA**; resume by reading "How to resume" then working through the user's issue notes.

**Automated tests: 58 passing** (`rootlink/backend/tests/`). Frontend `tsc --noEmit` + `next lint` clean. Production build (`next build`) compiles — **but do NOT run it while `next dev` is live** (see Gotchas).

Nothing has been committed to git — all changes are working-tree only.

---

## How to resume (do this first)

1. **Check servers are up** (they may have been stopped):
   - Frontend dev: http://localhost:3001 — log `/tmp/rootlink-dev.log`
   - Backend API: http://localhost:8001 — log `/tmp/rootlink-backend.log`
   - Check: `curl -s localhost:8001/api/health` and `curl -sI localhost:3001 | head -1`
2. **Restart if needed:**
   - Backend: `cd rootlink/backend && source .venv/bin/activate && setsid nohup uvicorn app.main:app --port 8001 > /tmp/rootlink-backend.log 2>&1 < /dev/null &` (takes ~15s to load the embedding model before `/api/health` returns 200).
   - Frontend: `cd rootlink/frontend && setsid nohup npm run dev > /tmp/rootlink-dev.log 2>&1 < /dev/null &` (it auto-picks a port; :3000 is taken by an unrelated "Open WebUI", so it lands on :3001).
3. **Run the test suite** to confirm a clean baseline:
   `cd rootlink/backend && source .venv/bin/activate && python -m pytest -q` → expect **58 passed**.
4. **Read the user's QA issue notes** (the user is keeping a separate list) and work through them one by one, in build mode, verifying each with tests / Playwright.

### Test super-admin login (in the dev DB)
- URL: http://localhost:3001/auth/login
- Email: `super@rootlink.app` · Password: `superadmin123`
- Flags: `role=super_admin, is_verified, can_self_publish, can_edit_copy, account_status=active` (user id 6 in `rootlink.db`).
- There's also `admin@rootlink.app` (user id 3) who owns most existing test articles.

---

## Gotchas / lessons (IMPORTANT — don't repeat)

1. **NEVER run `npm run build` while the `next dev` server is running.** They share `.next/`; the build clobbers the dev server's webpack chunks → `Cannot find module './NNNN.js'` → 500s / "lost formatting". Verify the frontend with **`npx tsc --noEmit` + `npm run lint` only**. If it happens: `rm -rf rootlink/frontend/.next` and restart dev (there's a `dev:restart` script).
2. **Restart the backend after backend changes** — the dev uvicorn runs **without `--reload`**, so code changes (new endpoints, migrations, seeds) are NOT picked up until restart. Symptom: new endpoints return 404, template picker empty, etc.
3. **Backend graceful shutdown can hang** waiting on open SSE notification streams. If a restart stalls, `kill -9` the old uvicorn pid (find via `pgrep -af "uvicorn app.main:app --port 8001"`), confirm `:8001` is free (`ss -ltnp | grep :8001`), then start fresh.
4. **`safeImageUrl` blocks private hosts** — fixed to trust `NEXT_PUBLIC_API_URL` origin, but remember uploaded media URLs are absolute `http://localhost:8001/media/...` in dev.
5. **`JSON` columns store Python `None` as JSON `null`**, not SQL `NULL` — don't use `body IS NULL` in migrations (we key authored-vs-crawled on `url IS NULL` instead).

---

## What's implemented (by phase)

All backend changes live in `rootlink/backend/`; tests in `rootlink/backend/tests/test_phase*.py`.

### Phase 0 — Foundations ✅
- `models/user.py`: `super_admin` role; `AccountStatus` enum; fields `can_self_publish`, `self_publish_agreed_at`, `can_edit_copy`, `account_status`, `suspended_until`, `banned_at`, `ban_reason`, `banned_by`; helpers `is_banned`, `is_suspended` (auto-expiring), `can_author`.
- `models/content.py`: `ContentStatus` extended → `draft/in_review/published/needs_changes/rejected/archived`.
- New `models/moderation.py` (`ModerationAuditLog` + `ModerationAction`) and `models/content_template.py` (`ContentTemplate`); registered in `models/__init__.py`.
- `core/security.py`: ban enforced in `get_current_user`/`get_optional_user`; new `get_writable_user` (blocks suspended from authoring).
- `api/auth.py`: ban blocked at login. `api/admin.py`: `require_role` treats `super_admin` as satisfying every gate.
- `main.py`: idempotent `ALTER TABLE users` migrations. `schemas/auth.py`: exposes the new flags.
- Tests: `test_phase0_enforcement.py`.

### Phase 1 — Lifecycle unification ✅
- **`status` is the single visibility gate** (`services/content_visibility.py`); `verification_status` is now a quality badge only.
- Trust-based publish (`articles.py`): untrusted → `in_review`; trusted/staff → `published`.
- Soft reject + appeal (`admin.py` reject = soft, no hard delete; `articles.py` `POST /{id}/appeal`).
- Approve publishes + badges; review queue reads `in_review`.
- `cross_reference.py` auto-publishes corroborated crawled content via `status`.
- `feed_crawler.py`: crawled items created as `draft` (were leaking as `published`).
- Data-preserving migration in `main.py` (keys authored vs crawled on `url IS NULL`).
- `models/content.py`: added `review_note`. Tests: `test_phase1_lifecycle.py`, `test_phase1_migration.py`.

### Phase 2 — Media ✅
- EXIF/GPS stripping in `services/image_processor.py` (privacy).
- Cover-required-at-publish + 4-source fallback (`services/default_cover.py`); per-category default SVGs in `frontend/public/images/defaults/`.
- `models/learning.py`: Lesson `poster` field (+ migration). Tests: `test_phase2_media.py`.

### Phase 3 — Templates + video poster ✅
- `content_templates` API (`api/content_templates.py`) + idempotent seed (`services/template_seed.py`, 6 starter templates) run in `main.py` lifespan.
- `services/oembed.py` (YouTube deterministic thumbnail + Vimeo oEmbed). Tests: `test_phase3_templates.py`.

### Phase 4 — Trust promotion + enforcement ladder ✅
- User-facing `api/self_publish.py` (`/api/me/self-publish/eligibility|accept`); `services/trust.py`.
- Admin endpoints in `admin.py`: grant/revoke self-publish, suspend, lift-suspension, ban (unpublishes their content), unban — all audit-logged.
- `get_writable_user` wired onto authoring endpoints (article create/update/publish/appeal, comment create, rate) so suspension actually blocks authoring. Tests: `test_phase4_trust_enforcement.py`.

### Phase 5 — Frontend ✅ (core)
- API client: `contentTemplates`, `selfPublish`, `articles.appeal` namespaces.
- `components/ui/Tooltip.tsx` + `InfoPopover.tsx` (the `(i)` system; exported from `ui/index.ts`).
- `components/nav/CreateMenu.tsx` — global "Criar/Create" menu, permission-gated; wired into `NavBar.tsx`.
- `components/editor/TemplatePicker.tsx` — template picker on article create (mounts Editor.js with the chosen template body).
- `app/articles/my/page.tsx` — full lifecycle badges + "what happens next" + rejection reason + Appeal; Edit shown for all non-archived.
- **Cover image field** on both new + edit article pages (`ImageUpload` w/ license disclaimer; preview + remove; loads existing cover on edit).
- Engagement: unique/throttled view counting (`services/view_tracking.py`, Redis + in-memory fallback) wired into article detail. Tests: `test_phase5_views.py`.
- Media: `ImageUpload` gained license/attribution + liability disclaimer (`requireLicense` prop); added to events + groups create forms; default covers applied on event/group create.
- i18n: `create.*` keys added to `messages/en.json` + `pt.json`.

### Phase 6 — GDPR ✅ (backend)
- `api/account.py`: `GET /api/me/export` (data export) + `DELETE /api/me` (erasure: de-author content → `created_by=NULL`, delete personal rows, delete user, audit-logged). Tests: `test_phase6_account.py`.

---

## Issues found in QA (this session)

**Fixed:**
1. ✅ Stale `.next` "lost formatting" — was the build/dev collision (see Gotcha #1). Fixed by clearing `.next` + restart.
2. ✅ Template picker / editor blank — backend was stale (Gotcha #2). Fixed by restart (seeds + endpoints).
3. ✅ Cards showed default image despite a body image — `safeImageUrl` blocked the localhost media host. Fixed (trusts `NEXT_PUBLIC_API_URL` origin) in `lib/image-url.ts`.
4. ✅ No Edit button on published articles — `isEditable` now allows all non-archived (`articles/my/page.tsx`).
5. ✅ No cover-image field — added to new **and** edit article pages.
6. ✅ Edit page stuck on skeleton on hard refresh — missing `authLoading` dep in the load effect.
7. ✅ "Save Draft" silently updated a live (published) article — published edits now use an explicit **"Update article"** button, **no autosave** for published; backend sends untrusted edits of published content back to `in_review` (`update_article`, spec §2.4).
8. ✅ Lost unsaved changes on logo click, no warning — upgraded `lib/use-dirty-guard.ts` to also intercept in-app `<Link>` clicks (capture-phase confirm) + `beforeunload`; wired into new + edit article pages and their back buttons.

**QA round 2 — groups / events / learning (8 issues, all fixed):**
1. ✅ Create menu "Event" opened list → now `/events?new=1` auto-opens the create form (`useSearchParams`).
2. ✅ Create menu "Group" opened list → now `/groups?new=1` auto-opens the create form.
3. ✅ Group create cover vanished after upload → form now shows a persistent cover preview + remove (mirrors article cover).
4. ✅ Group cards + detail showed no image → list cards + detail header now render `image_url` (default cover applied on create).
5. ✅ No group edit → backend `PATCH /api/groups/{id}` (creator / group admin-moderator / platform staff) + inline Edit on the group detail page (`_can_manage_group`).
6. ✅ Admin hard-deleted groups → now **super_admin-only soft archive** (`POST /api/admin/groups/{id}/archive`): sets `Group.status=archived`, notifies all members, hides from public list/search/detail; data preserved. Hard `DELETE` is now super_admin-only too. (`Group.status`/`archived_at` added + migration.)
7. ✅ Course create had no cover upload → `ImageUpload` with preview/remove.
8. ✅ Path create had no cover upload + missing from nav → `ImageUpload` added; "Learning path" added to the Create menu (contributor-gated).
- Also fixed: cover **labels** showed raw i18n keys (`t(k) || fallback` doesn't work since `t` returns the key) — added `events.cover_label`, `groups.cover_label`, `learning.cover_image`, `create.path/path_desc` to en+pt.
- Tests added: `test_groups_manage.py` (7). **Total now 65 passing.**

**Still open / noted:**
- ⏳ **User is still compiling more issues** — keep triaging as they come.
- 🐞 Pre-existing: `groups.category` column is **NOT NULL** in the dev DB (model says nullable) → creating a group with no category 500s. The real form always sends a category; fresh DBs are fine. Needs a table-rebuild migration to fully fix (SQLite can't drop NOT NULL in place).
- 🐞 Pre-existing bug `api/external.py:32` `species_search`: `TypeError: object tuple can't be used in 'await' expression` (unrelated; offered to fix).
- Note: full "deprecation with a member-facing grace-period timer" (issue 6's stretch goal) is implemented as immediate archive + notification; a scheduled-purge timeframe is a future enhancement.

---

## 🚀 Deployed to production — 2026-06-29

All of the below is **live**. Verified after deploy: prod backend `/api/health` 200,
new endpoints 200 (`/api/content-templates` returns the 6 seeded templates), both
uvicorn workers start clean (no `create_all` race), `alembic upgrade head` no-op,
frontend routes (`/`, `/articles/my`, `/groups`, `/learning`) 200 on Vercel.

Pre-deploy safety: ran the real prod Docker image (2 workers) against a **copy of the
live prod DB** — caught & fixed the 2-worker `create_all` race (flock) and made the
`groups.category` rebuild crash-safe (savepoint); data-visibility invariant preserved.
See commit `812d372`. `deploy.sh` backed up the prod DB before applying.

## Roadmap round 3 (done this session)

- ✅ **Phase 6b — editable site copy (§12):** `copy_override` model + `api/copy.py` (`GET /api/copy?locale` public; `PUT`/`DELETE /api/copy/{key}` gated by `can_edit_copy`/super_admin; `GET /api/copy/all`). `locale-context.tsx` merges overrides over static JSON at runtime. New admin editor at `/admin/copy` (searchable, per-locale edit + revert). Tests: `test_copy.py` (5).
- ✅ **super_admin admin access fix:** `AdminSidebar` treated `super_admin` as non-admin (couldn't see config/admin). Now `super_admin` is in `allowed` + `isAdmin`; added `can_edit_copy` gating for the Site-copy link.
- ✅ **Pre-existing bug fixes:** `api/external.py` species search (`asyncio.gather` instead of awaiting a tuple); `groups.category` NOT NULL → guarded SQLite table-rebuild migration (tested on a DB copy first; data preserved, now nullable).

**Total backend tests now: 70 passing.**

## Deferred / not yet done

- **Phase 5b-ii:** generalize "My Articles" → cross-Kind "My Content" dashboard; engagement counts on public cards (needs `rating_up`/`view_count` added to the search/feed response shapes — low value, deferred).
- **Moderation ML service (SHADOW mode):** Detoxify / NudeNet / Falconsai ViT / Whisper — infra-heavy (models + container + Celery), deliberately its own task. Audit `ModerationAction` enum already has `auto_allow/auto_review/auto_block` hooks.
- **Spec follow-ups:** liability-disclaimer legal sign-off (§6.2); per-Kind retention periods (§8); `is_verified` currently doubles as the "email verified" signal for self-publish eligibility (consider a dedicated `email_verified`); editable-copy inline "click any text to edit" mode (the admin editor page covers the need for now).

---

## Verification commands (quick reference)

```bash
# Backend tests + lint
cd rootlink/backend && source .venv/bin/activate && python -m pytest -q && ruff check app/ tests/

# Frontend checks (NEVER `npm run build` while dev server runs)
cd rootlink/frontend && npx tsc --noEmit && npm run lint

# Knowledge graph (after code changes)
cd /home/rui/projects/RootLink && graphify update .
```
