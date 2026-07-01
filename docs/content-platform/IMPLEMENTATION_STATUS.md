# Content Platform — Implementation Status

> **Status:** ✅ SHIPPED — live in production (2026-06-29). Chapter closed.
> **Spec:** [`CONTENT_PLATFORM.md`](./CONTENT_PLATFORM.md) · **Mockups:** [`mockups/`](./mockups/)
> **Lessons learned (read before similar work):** [`../LESSONS.md`](../LESSONS.md)

---

## TL;DR

The full content platform (backend Phases 0–6 + frontend) is **implemented, tested, committed, pushed, and deployed to production**. Verified live after deploy: backend `/api/health` 200, new endpoints 200, both uvicorn workers start clean, Vercel frontend live, super_admin created.

- **Automated tests: 70 passing** (`rootlink/backend/tests/`). Frontend `tsc --noEmit` + `next lint` + **`next build`** all clean.
- All work is committed to `main` and pushed to GitHub (Vercel + backend both deployed).
- Production super_admin: **`admin@rootlink.app`** (elevated to `super_admin` + `can_self_publish` + `can_edit_copy`); dev DB also has `super@rootlink.app` / `superadmin123`.

## Local dev quick reference

- Frontend dev: http://localhost:3001 (`/tmp/rootlink-dev.log`); backend API: http://localhost:8001 (`/tmp/rootlink-backend.log`).
- Start backend: `cd rootlink/backend && source .venv/bin/activate && setsid nohup uvicorn app.main:app --port 8001 > /tmp/rootlink-backend.log 2>&1 < /dev/null &` (~15s to load the embedding model).
- Start frontend: `cd rootlink/frontend && setsid nohup npm run dev > /tmp/rootlink-dev.log 2>&1 < /dev/null &` (:3000 is an unrelated app; it lands on :3001).
- Tests: `cd rootlink/backend && source .venv/bin/activate && python -m pytest -q` → **70 passed**.
- Deploy: `./scripts/deploy.sh` (see `DEPLOY.md`). **Always run `npm run build` before a frontend deploy** (see LESSONS.md).

> The full hard-won gotchas/lessons now live in **[`docs/LESSONS.md`](../LESSONS.md)** (surfaced via `AGENTS.md`) and deployment specifics in **`DEPLOY.md`**.

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

## QA round 3 — learning covers & video thumbnails (3 issues, fixed + deployed)

1. ✅ Course/Path **edit** pages showed a raw `image_url` text input → now use `ImageUpload` (preview/remove + license), matching the new pages.
2. ✅ Learning page **path cards** showed no cover → render `path.image_url` (and hardened course covers via `safeImageUrl`).
3. ✅ Course detail **lessons with video** had no thumbnail → show `poster`, else a client-derived YouTube thumbnail with a play overlay; `lessons.poster` exposed in `LessonResponse`. New `lib/video.ts` mirrors backend `services/oembed.py`. (Commit `cdda7c4`.)
   - Edge: YouTube thumbnails derive client-side (no backend dep); **Vimeo** lessons only show a thumb once `poster` is populated (set via oEmbed on lesson save; existing Vimeo lessons would need a re-save/backfill).

### Vercel deploy gotcha that bit us (now logged in DEPLOY.md 9a + LESSONS.md)
The first frontend deploy this session **failed on Vercel** — `useSearchParams()` on `/events` & `/groups` needs a Suspense boundary for Next 14 static export. `tsc`/`lint` don't catch it; only `next build` does, which had been skipped to protect the dev server. Live site silently stayed on the old build. Fixed by reading the query via `window.location.search`; **now always run `next build` before a frontend deploy.**

## Roadmap round 4 — Content UI Editor (2026-07-01)

Shipped the previously-deferred inline "click any text to edit" mode, expanded to also cover
images and icons. Design doc: `discovery/mockups/content-ui-editor/briefing-to-build-local.md`.
Reference mockup (button/mode mechanics only): `discovery/mockups/content-ui-editor/index.html`.

- ✅ **Backend:** new `content_ui_overrides` table + `api/content_ui.py` (`GET /api/content-ui`
  public; `PUT`/`DELETE /api/content-ui/{key}` gated **strictly** to `super_admin`, no
  `can_edit_copy` delegation — deliberately stricter than the existing `/api/copy` gate). Text
  overrides reuse `/api/copy` unchanged. Tests: `test_content_ui.py` (6, all passing; 76 total now).
- ✅ **Frontend:** `EditorModeProvider` (pending-changes-until-save model, per-page "Reset page",
  `useDirtyGuard` integration for confirm-before-navigate) + `EditorModeChrome` (toggle pill at
  `bottom-20 right-4` — clears the toast stack and mobile bottom bar) + three wrapper components:
  `EditableText`, `EditableImage` (reuses `ImageUpload` → `/api/images/upload`, no new storage
  code), `EditableIcon` (fixed curated registry, `lib/icon-library.ts`, deliberately no free-form
  SVG/upload to avoid an XSS surface). All render as portals to `document.body` when open as
  modals — required because several editable slots (e.g. homepage category icons) sit inside
  `<Link>` elements, and a non-portaled modal's clicks bubble to the anchor's default navigation.
- ✅ **Phase 1 wiring:** homepage (`app/page.tsx`) hero, section headers/subtitles, CTA buttons →
  `EditableText`; homepage category icons → `EditableIcon`. **Nav/footer and `EditableImage` are
  NOT wired to any live page yet** — nav/footer labels sit inside dropdown click-handlers (edit
  risk not worth it yet) and no static marketing image currently exists in the codebase to attach
  `EditableImage` to without a page-design change (out of scope per the brief). The component and
  backend are fully built and Playwright-verified against a live slot regardless.
- ✅ **Verified live (Playwright, not just unit tests):** super_admin toggles editor mode → edits
  headline → saves → **persists across a full page reload** → a logged-out visitor and a
  plain "user"-role account never see the toggle at all → icon swap end-to-end → "Reset page"
  discards pending edits without a backend call → navigating away with pending edits triggers the
  existing `useDirtyGuard` confirm dialog.
- **Known limitation:** per-element "revert to default" for *text* (as opposed to the page-level
  Reset) re-derives the static default by dynamically importing `messages/{locale}.json` inside
  the provider — correct, but if `messages/*.json` keys are ever restructured, revert for very
  deeply-nested keys should be re-tested.

### Fix round (2026-07-01, same day) — real bugs found in first-round manual QA

Three real bugs + two UX gaps found by manual testing, all fixed and re-verified with Playwright:

- ✅ **"Leave anyway" didn't actually discard edits.** `useDirtyGuard`'s confirm only gated
  navigation, nothing cleared the pending-drafts state afterward — so a discarded edit was still
  sitting in memory and reappeared on navigating back. Fixed by adding an `onConfirmedLeave`
  callback to `lib/use-dirty-guard.ts` (new optional param, backward-compatible — 8 other existing
  callers unaffected) that `EditorModeProvider` uses to clear all drafts.
- ✅ **Save briefly reverted text to the old value.** Images/icons already cached the saved value
  locally (`committedImages`/`committedIcons`) so they display correctly right after save without
  needing a refetch; text was missing the equivalent `committedText` cache, so clearing
  `textDrafts` after save fell back to the *stale* `t()` result (locale-context only fetches
  `/api/copy` once per locale change, not after every save) until a full refresh re-fetched it.
  Added `committedText` mirroring the image/icon pattern.
- ✅ **"Reset page" had no confirmation** — a bulk-discard action with zero warning. Added a native
  `confirm()` (matches the existing pattern in `admin/config`'s family-delete flow), localized via
  new `editor.reset_confirm` key.
- ✅ **Navigation confirm message improved + localized.** Kept the native 2-button browser
  `confirm()` (a custom 3-button Discard/Save/Cancel dialog is impossible for the hard
  refresh/tab-close case regardless — browsers force their own fixed-button prompt there, by
  design, so a custom dialog would only ever cover the in-app-link-click case, inconsistent UX).
  Instead the message itself now tells the user what to do: `editor.leave_confirm` — PT: "Tens
  alterações por guardar. Cancela para as guardar antes de sair."; EN: "Unsaved changes. Press
  Cancel to save them before leaving." New i18n keys in both `messages/en.json`/`pt.json` under a
  new `editor` namespace.
- ✅ **Homepage category card copy.** Confirmed via the actual model (`TaxonomyFamily` has
  `label`/`label_pt`, no `description` field) that the card *name* already has one true owner
  (`/admin/config`) but the *description* paragraph was a generic template
  (`t("home.discover_category", {category})`) owned by nothing. Made the description (not the
  name) editable via `EditableText` with a new `defaultText` prop (falls back to the current
  generated sentence when no override exists yet — needed because these are per-family generated
  keys like `home.category.agricultura.description` with no entry in `messages/*.json`).
- ✅ **`EditableText` had the same "modal-nested-in-`<Link>`" navigation bug as icons/images** (see
  `docs/LESSONS.md` #16) — clicking to start editing a `<p>`/`<h3>` inside a homepage category card
  (an `<a>`) would also navigate away. Fixed with `e.preventDefault()` in the click handler, always
  (not just modals — any click-to-activate inside an anchor needs this).
- ✅ **Visual redesign.** The original chrome used Tailwind's default `emerald` and default
  sans-serif font — inconsistent with the platform's actual design system
  (`tailwind.config.ts`: taupe/brown `primary`, terracotta `rust`, `Fraunces` display font;
  Button.tsx's shadow/hover-lift treatment). Rebuilt: "Edit page" = the same `primary-600`/`cream`/
  `font-display` treatment as any other primary CTA on the site (e.g. the homepage's "Pesquisar"
  button); "Exit editor" (active state) = `rust-600`, signaling a distinct mode without introducing
  an off-palette color; "Save changes"/"Reset page" now literally render `components/ui/Button.tsx`
  (`primary`/`danger` variants) instead of hand-rolled buttons; editable-element hover/active
  outlines switched from emerald to rust to match.

### 🔴 Deployed 2026-07-02 — production access + a permission bug found along the way

Deployed to production via `./scripts/deploy.sh`. Post-deploy: tried to promote the real production
admin (`admin@rootlink.app`, role `admin`) to `super_admin` so they could use this feature, and
**caught a pre-existing bug before applying it** — see `TECH_DEBT.md` §0 (🔴 high priority): 23
authorization checks across 8 API modules don't treat `super_admin` as a superset of `admin`, so
promoting a real admin today would cost them cross-user edit/delete on articles, events, courses,
plants, marketplace listings, feeds, and taxonomy admin.

**Stopgap (in place now):** created a separate, dedicated production account,
`content-ui-editor@rootlink.app` (role `super_admin`), for using this feature — `admin@rootlink.app`
was left completely untouched (still `role: admin`, verified). Password shared with the user
out-of-band (not in any file) — they should rotate it after first login. **This is a stopgap, not
the fix** — see `TECH_DEBT.md` §0 for the real fix, which should land before anyone tries to
promote a real admin account again.

## Deferred / not yet done

- **Phase 5b-ii:** generalize "My Articles" → cross-Kind "My Content" dashboard; engagement counts on public cards (needs `rating_up`/`view_count` added to the search/feed response shapes — low value, deferred).
- **Moderation ML service (SHADOW mode):** Detoxify / NudeNet / Falconsai ViT / Whisper — infra-heavy (models + container + Celery), deliberately its own task. Audit `ModerationAction` enum already has `auto_allow/auto_review/auto_block` hooks.
- **Spec follow-ups:** liability-disclaimer legal sign-off (§6.2); per-Kind retention periods (§8); `is_verified` currently doubles as the "email verified" signal for self-publish eligibility (consider a dedicated `email_verified`).
- **Content UI Editor Phase 2:** wire `EditableText` into nav/footer; wire `EditableImage` into a real static image slot once/if one is introduced; expand `EditableText` coverage namespace-by-namespace beyond the homepage.

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
