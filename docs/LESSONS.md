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

16. **A modal rendered as a normal React child (not a portal) is still a DOM descendant of
    whatever it's nested inside** — even though `position: fixed` makes it look full-screen and
    unrelated. If that ancestor is an `<a>`/`<Link>` (e.g. an editable icon/image slot placed
    inside a card that links somewhere), clicking any button *inside* the modal bubbles up to the
    anchor and triggers its default navigation, closing the modal without applying anything.
    Symptom: a picker/apply button appears to do nothing, or the page silently navigates away.
    Fix: render the modal via `createPortal(modal, document.body)` so it's outside that DOM
    subtree entirely — don't just add `stopPropagation`/`preventDefault` to every button inside it
    (fragile, easy to miss one). (Content UI Editor, 2026-07-01 — `EditableIcon`/`EditableImage`.)
    **Same class of bug also hits any inline click-to-activate element** (no modal needed) — a
    click-to-edit `<p>`/`<h3>` nested in an `<a>` still needs `e.preventDefault()` in its own click
    handler, every time it's clicked (not just the first click that activates it), or it navigates
    away instead of entering edit mode. (`EditableText`.)

17. **Flipping an element's `contentEditable` to `true` in React does not move browser focus to
    it.** Focus only transfers automatically to an element that was *already* focusable at the
    moment of the physical click; React updating the attribute afterward doesn't retroactively
    focus it. If a click handler sets `contentEditable=true` via state, add a `useEffect` keyed on
    the editing flag that calls `.focus()` (and places the cursor via `Range`/`Selection` if you
    want it at the end) once the element re-renders as editable. Also remember hooks must run
    unconditionally — put this `useEffect` *before* any early `return` that depends on the same
    state, or you'll hit "Rendered more hooks than during the previous render." (Content UI Editor,
    2026-07-01 — `EditableText`.)

18. **Never call a state setter (e.g. a toast/`addToast`) from inside another setter's functional
    updater** (`setMode((m) => { ...; addToast(...); return next; })`). React logs "Cannot update a
    component while rendering a different component" because the updater runs during render.
    Compute the next value first, call `setMode(next)`, then call the side-effecting setter
    afterward, outside the updater. (Content UI Editor, 2026-07-01 — `EditorModeProvider`.)

19. **`/api/auth/login` is rate-limited (5 req/60s, `core/rate_limit.py`).** Scripted/E2E tests that
    log in repeatedly in a short loop will start getting silently-failed logins (no redirect, no
    error surfaced) once the limit is hit — this is correct behavior, not a bug, but it's easy to
    mistake for a broken login flow mid-debugging. Space out repeated test logins or reuse one

20. **A locally-cached "committed" value (state kept in memory after a successful save) must exist
    for *every* editable field type, not just some of them.** Building the Content UI Editor,
    images/icons got a `committedImages`/`committedIcons` cache so Save reflects immediately without
    a refetch — text was left relying on `t()` alone, which is only fetched once per locale change,
    so Save appeared to silently revert until the next full page refresh. If you add this pattern
    for some fields, audit that *every* field sharing the same save flow got it too.

21. **Extending a shared hook used by many callers: add an optional second parameter with the same
    default behavior, never change what existing callers get.** `useDirtyGuard(dirty)` is used in 8+
    places; adding a confirm-message override + a post-confirm callback for the Content UI Editor
    was done as `useDirtyGuard(dirty, { message, onConfirmedLeave })` — every other caller still
    passes just `dirty` and behaves exactly as before. Grep for all existing usages before changing
    a shared hook's signature.

23. **`committedText` (Content UI Editor) was only ever populated from local session actions
    (save/revert), never fetched from the server** — unlike `committedImages`/`committedIcons`,
    which `fetchOverrides()` populates from `GET /api/content-ui` on entering editor mode. This
    was invisible during Phase 1 (homepage-only, tested mostly within one unsaved session) but
    broke Phase 2's per-element text "revert to default" affordance: after a real page reload,
    `committedText` was empty again even though the override still existed server-side (`t()`
    itself showed the saved value fine — that part *is* fetched via the normal copy/locale
    pipeline — but the *local* cache used to decide "does a revert option exist" wasn't). Fixed by
    also fetching `api.copy.get(locale)` inside `fetchOverrides()`, same pattern as images/icons.
    Caught by an end-to-end Playwright check that specifically reloaded the page between save and
    revert, rather than testing everything within one continuous session — do this for any
    "revert/undo" feature, not just Add/Save. (Content UI Editor Phase 2, 2026-07-02.)

24. **This repo runs behind sandboxed port-forwarding where `localhost:3000` may not be the actual
    Next.js dev server.** `ss -ltnp` can show a process bound to `0.0.0.0:3000` with no owning PID
    visible, while the real `next-server` process is listening on a different port entirely (seen:
    3001) — hitting the "obvious" port returns a plausible-looking 200 OK from a *completely
    unrelated* service (seen: an "Open WebUI" instance), which is a silent trap for
    curl/Playwright-based verification (wrong content, no error, easy to misdiagnose as an app bug).
    Always confirm with `ss -ltnp | grep node` (or match the actual `next-server`/`uvicorn` PID)
    before trusting `localhost:<default-port>` in this environment.

35. **`package.json`'s `dev:restart` script (`rm -rf .next .next-build && next dev`) does NOT
    reproduce how the dev server is actually running if it was started with an explicit port
    flag.** This repo's real dev server runs as `next dev -p 3001` (lesson #24) — running the bare
    `npm run dev:restart` after a prod-build verification would start a *new* server on the
    default port 3000 instead (which already has an unrelated process bound to it, see #24),
    leaving the "real" 3001 server down and a second, differently-configured one up on the wrong
    port. Always inspect the actual running command first (`ps -p <pid> -o cmd`, or
    `pstree -ps <pid>`, to see the exact invocation, e.g. `sh -c "rm -rf .next .next-build &&
    next dev -p 3001"`) and reproduce that exact command on restart, not just the generic
    `package.json` script name. Relatedly, a backgrounded `setsid nohup sh -c "... && next dev
    -p 3001"` can fail silently-ish with `sh: 1: next: not found` if `node_modules/.bin` isn't on
    `PATH` in the tool's shell (it commonly isn't, outside an `npm run`/`npx` wrapper) — use the
    explicit `./node_modules/.bin/next` path, or `npx next dev -p 3001`, and always check the
    redirected log file a few seconds after backgrounding to confirm it actually started before
    moving on. (Roles/permissions redesign deploy-prep, verifying the production build without
    corrupting the live dev server, 2026-07-04.)

28. **Seeding `localStorage` for a Playwright auth check via `page.goto()` → `page.evaluate(setItem)`
    → `page.reload()` is a race, not a reliable pattern** — under any real load (e.g. several pages
    open in the same browser instance back-to-back), the initial `goto()` navigation can still be
    in flight when `evaluate()`/`reload()` fire, so the token never actually lands in the storage
    the app reads on its real load. Symptom: the check *looks* like a real permission bug (an
    authenticated user rendering as logged-out, or a just-fixed gate still appearing to fail) when
    it's actually a test-harness timing bug. Fix: use `context.add_init_script(...)` to set
    `localStorage` **before** any page script runs, on a fresh `browser.new_context()` per identity
    being tested (isolated storage, no cross-run bleed) — then a single `page.goto()` is enough,
    no reload race. Confirmed by re-running the exact same check both ways: the racy version
    reported a real `super_admin` user as "signed out" with the fixed permission gate still hidden;
    the `add_init_script` version correctly showed the gate now working. (Roles/permissions Phase 3
    frontend cutover, live-verifying `usePermission`/`isStaff` fixes against the running dev server,
    2026-07-04.)

22. **A native `confirm()`/`beforeunload` dialog cannot have custom buttons, ever, on any modern
    browser** (this is a deliberate browser security restriction, not a framework limitation) — you
    get exactly "OK"/"Cancel" with fixed browser-chrome labels for `beforeunload`, and `confirm()`
    lets you customize the *message* but never the button text or count. A 3-option "Discard / Save
    / Cancel" flow is only achievable with a custom in-app modal, and only for in-app navigation
    (link clicks) — a hard refresh/tab-close will always fall back to the browser's own 2-button
    prompt with no way to offer a "Save" action from within it. Don't promise 3-button UX for the
    hard-navigation case; word the 2-button dialog's message to guide the user instead (e.g. "Press
    Cancel to save first").
    session across assertions.

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

27. **The `/api/auth/login`/`/api/auth/register` rate limiter's in-memory state (lesson #19) is
    shared across an entire `pytest` process, not reset per test or per test file.**
    `RateLimitMiddleware` is attached once to the module-level `main.app` singleton
    (`app.add_middleware(...)` at import time); `conftest.py` reuses that same `app` object for
    every test via `ASGITransport(app=main.app)`, and Starlette only builds/caches the middleware
    stack (and its `_hits` dict) once per process — so hit counts accumulate across every test
    *file* in the same `pytest` run, keyed by client IP (which is constant, e.g. `"unknown"`, for
    every `ASGITransport` request, so all test files effectively share one counter per rate-limited
    path). Symptom: a new test file that calls the real `/api/auth/register`/`/api/auth/login`
    endpoints passes in isolation (`pytest tests/test_new_file.py`) but fails with 429s only when
    run as part of the **full** suite (`pytest -q`), because earlier test files in the same process
    already used up part of the shared quota (3 registers/60s, 5 logins/60s). Fix: don't add up
    live register/login calls carelessly across new tests — use the `make_user` fixture (direct DB
    insert, bypasses the endpoint and its rate limit entirely) for setup, and mint a real *tracked*
    session (if one is needed) via `issue_token_for_user(session, user)` directly rather than a live
    `/api/auth/login` POST, reserving actual endpoint calls for the one assertion that's
    specifically testing register/login's own behavior. (Roles/permissions Phase 2, session +
    force-logout/password-reset tests, 2026-07-03.)

26. **Renaming a SQLAlchemy column that's also a Pydantic response-schema field name
    (`from_attributes`) breaks serialization unless you add a compat shim.** Pydantic's
    `from_attributes` does a plain `getattr(orm_obj, field_name)` — if you rename the underlying
    `mapped_column` attribute (e.g. `User.entity_type` → `organization_kind`, done for the
    roles/permissions redesign to stop it colliding with the new "entity" concept) but a response
    schema (`UserResponse`) still declares a field literally named `entity_type`, add a read-only
    `@property` on the model with the OLD name that returns the new attribute's value — this keeps
    every existing response payload working with zero serializer changes. **But a plain `@property`
    is not a SQLAlchemy `InstrumentedAttribute`**: any `select()`/`where()`/`group_by()` clause that
    referenced the old attribute name (e.g. `User.entity_type == x`) must be updated to the new
    column attribute directly (`User.organization_kind == x`) — the property only helps at the
    ORM-instance-read layer, not query construction, and silently returns a Python `property`
    object (not a query expression) if you forget and use it inside a `select()`. SQLite's
    `ALTER TABLE ... RENAME COLUMN` (supported since 3.25, confirmed present here: 3.45.1) does the
    DB-side rename in the same idempotent-guarded pattern as any other lifespan migration — check
    `PRAGMA table_info` for old-name-present/new-name-absent before renaming, so it only fires once
    and no-ops on every later restart or a racing second worker. (Roles/permissions Phase 1 first
    slice, `entity_type` → `organization_kind`, 2026-07-03.)

29. **A guarded lifespan `ALTER TABLE ... ADD COLUMN` loop that predates a later column rename can leave a stray, unused duplicate column behind on dev DBs created before the rename shipped.** Confirmed on the live dev DB while verifying Phase 4's migration: `users` has both `organization_kind` (the real, current column) AND a stray, always-empty `entity_type` column — the *original* Phase-0-era migration loop (`("entity_type", "VARCHAR(50)")`, still present in `main.py` for very old DBs that predate even that) runs unconditionally on every boot and re-creates `entity_type` as a plain `VARCHAR` if a fresh `create_all` ever skipped it (the current `User` model has no real mapped `entity_type` column, only a read-only `@property` — see lesson #26) — and the separate rename-guard step only fires when `organization_kind` is *absent*, so once `organization_kind` already exists (e.g. from `create_all` on a DB created after the rename shipped), the stray `entity_type` column from the older loop is never cleaned up. Harmless (nothing reads/writes it via the ORM), but confusing if you inspect the raw DB schema and wonder why both columns exist. Pre-existing since Phase 1, not introduced by Phase 4 — noted here instead of "fixed" since cleaning up old migration loops that already ran successfully on a live DB is its own, separate-risk workstream, not a Phase 4 concern. (Roles/permissions Phase 4, 2026-07-04.)

30. **A public GET listing endpoint's `visible_only` (or similar admin-set) query flag is a DIFFERENT axis from a moderation/enforcement-driven hide** — don't conflate them. `EventVendor.visible_to_attendees` only filtered the `GET /{event_id}/vendors` listing when the caller explicitly passed `visible_only=true`; the new Phase 4 cross-entity cascade-hide (`cascade_hidden_at`) needed to apply **unconditionally** regardless of that flag (a banned entity's vendor listing must disappear from the default listing too, not just the opt-in "visible only" one). Model the enforcement-driven hide as its own nullable timestamp column, filtered unconditionally, separate from whatever admin-controlled visibility booleans already exist on the same row — don't repurpose the existing admin flag for the enforcement case (you'd have no way to tell "admin turned this off" from "cascade hid this," and reversal would clobber the admin's own prior setting). (Roles/permissions Phase 4, cross-entity ban cascade, 2026-07-04.)

31. **In a FastAPI router, literal-path routes must be registered BEFORE a catch-all `/{param}` route in the same router**, or they silently get swallowed as a value for that param instead. `app/api/entities.py` already ended with `GET /{entity_id}` (Phase 4) — adding Phase 5's `GET /verification-queue` and `GET /mine` as new routes on the same router required inserting them physically earlier in the file (registration order = matching order), not just anywhere; had they been appended after `/{entity_id}`, a request to `/api/entities/mine` would have matched `/{entity_id}` first with `entity_id="mine"` and failed FastAPI's int-path-param validation (422), not routed to the real handler. Grep every router file's existing catch-all `/{...}` routes before appending new literal-path siblings to it. (Roles/permissions Phase 5, 2026-07-04.)

32. **`page.wait_for_load_state("networkidle")` hangs indefinitely (30s timeout) against this app's real pages**, distinct from lesson #28's localStorage-seeding race — this app keeps at least one persistent connection open on essentially every authenticated page (notifications polling / SSE), so the network never actually goes idle. Symptom: every Playwright script that navigates with `wait_for_load_state("networkidle")` times out on the very first `page.goto()`, even against a healthy, fully-rendered page. Fix: use `wait_for_load_state("domcontentloaded")` followed by an explicit `page.wait_for_timeout(1500-2000)` instead, for every navigation in a live-verification script against this app — don't reach for `networkidle` here at all. (Roles/permissions Phase 5, live-verifying the entity registration/verification/team flows, 2026-07-04.)

33. **A bulk find/replace meant to fix stale doc-path citations in code comments can silently corrupt runtime data or user-facing copy if you don't grep for context first.** Doing a repo-wide `final-spec.md` → `docs/roles-permissions/ROLES_PERMISSIONS.md` sweep after promoting that doc out of `backlog/` caught two false positives that looked exactly like every other comment hit: (1) `app/services/roles_migration.py` passes a string literal citing `phase0-decisions.md (b)` as the `reason=` argument to `log_moderation(...)` — that's **runtime audit-log data**, not a comment, and rewriting it would have silently changed what gets stored in the DB for every future migration run; (2) `app/entity/convert/page.tsx` has a rendered `<p>` citing `final-spec.md §2` in its help text — that's **end-user-visible UI copy**, not a code comment. Both were caught only by re-reading each `grep` hit's surrounding line before trusting a blind `sed`/`perl -pi` pass, and both were reverted to their original text since a docs/comments-only phase shouldn't touch application data or rendered strings even when the change looks cosmetic. When doing this kind of rename sweep: grep first, categorize every hit (comment/docstring vs. string literal vs. rendered template text) before running the bulk replace, not after. (Roles/permissions Phase 6, doc reconciliation, 2026-07-04.)

34. **Logging out (or a session becoming invalid mid-use — ban/suspend/restrict/force-logout/expiry) did not force any navigation, and no code path ever re-validated an already-mounted page's auth state.** Found via real user testing, not a code review: staying logged into `/admin/*` after clicking "Log out" (or after the session was otherwise invalidated) left the current page fully rendered with whatever it had already fetched into local state — `AdminSidebar` only checked auth **once, on mount**, via its own independent copy of `user` (a separate `api.auth.me()` call, not the shared `useAuth()` context), so a logout anywhere else in the app never reached it. Some admin pages (e.g. `app/admin/plants/page.tsx`) do **zero** auth checking at all and just display whatever they already fetched, indefinitely. The next API call made from a page in this state correctly gets a 401 from the backend, but with no global handler, that either did nothing visible (stale data just stays) or surfaced as an "Unhandled Runtime Error" for whichever specific call site didn't wrap it in try/catch (almost none do). **Fix, three parts, all necessary together:** (1) `logout()` now does a hard `window.location.href = "/"`, not a state-only clear — a real page load is the only way to guarantee no other already-mounted component's local state can keep showing stale data; (2) `lib/api.ts`'s shared `request()` now dispatches a `rootlink:session-invalid` window event whenever a request that WAS sending a token gets a 401 back (guarded on `token` being present, so a plain wrong-password login attempt — which never sends a token — doesn't trigger it), and `auth-context.tsx` listens globally and calls the same `logout()`; (3) that same 401-with-token branch in `request()` deliberately does **not** throw — it dispatches the event and returns a promise that never resolves, since the whole page is about to unmount from the redirect anyway, so there's nothing useful for the individual caller to do with a rejection (throwing here reintroduced the exact "Unhandled Runtime Error," racing against the redirect, even though the redirect itself was already correct — confirmed by re-running the same Playwright reproduction before and after this specific change). (4) `AdminSidebar` now reads `useAuth()` from the shared context instead of its own independent, mount-once-fetched copy, so it's reactive to the same global state everything else uses. **This is not a localhost-only quirk** — it's pure client-side architecture and behaves identically in production. It also means the Phase 2/4 force-logout/ban/suspend/restrict endpoints only fully "work" client-side as of this fix — before it, they correctly cut off *new* page loads and *new* API calls, but couldn't clear an already-open, already-rendered admin tab in real time. When testing a fix like this, don't trust the first "it redirected!" result as complete — rerun with `page.on("pageerror", ...)` wired up specifically, since the redirect and the stray uncaught error are two separate things that can each be fixed independently and easily mistaken for one another. (Roles/permissions post-implementation fix, found via real user testing on the admin users page, 2026-07-04.)

38. **Rank-only gates (`require_super_admin` / `rank_at_least(5)`) cannot express "platform-only" —
    an organization's own rank-5 super admin passes them.** Rank is per-entity: an org's founder is
    a legitimate rank-5 super admin *within their own entity*, so a bare rank check silently grants
    them a platform-wide action the spec reserves for platform staff (`ROLES_PERMISSIONS.md` §8's
    "blast radius crosses entities" actions). Platform-only actions must use the registry check —
    `can(user, action)` against a `platform`-scope registry entry — which encodes the
    entity-precedence rule a raw rank number can't. Found live on `group.archive` (2026-07-04): its
    endpoint used `require_super_admin` and wrongly passed an org's own rank-5 super admin; the gap
    only surfaced while building `event.archive` next to it with the correct `can()` gate. Fixed
    (`can(user, "group.archive")`) + regression test `test_org_super_admin_cannot_archive_group` in
    `tests/test_groups_manage.py`. When touching any platform-only endpoint, grep for the other
    `require_super_admin` uses and check each one's registry scope — every remaining rank-only gate
    on a `platform`-scope action is this same latent bug waiting. (Roles/permissions UI backlog
    batch 3, 2026-07-04.)

## Shell / ops

11. **`pkill -f "<pattern>"` can kill your own shell** because the pattern matches your running
    command line (which contains the pattern). Kill by **PID** instead, or use a pattern that can't
    match the command you're typing.

12. **Background long-running servers:** launch with `setsid nohup … > log 2>&1 < /dev/null &`,
    then poll a log/health endpoint in a *separate* command — the launching command otherwise hangs
    on the child's fds until the tool times out.

25. **A full `/graphify` rebuild resets every community label to a placeholder** ("Community 0",
    "Community 1", ...) — the pipeline's Step 4 (`.opencode/skills/graphify/SKILL.md`) unconditionally
    writes `labels = {cid: 'Community ' + str(cid) ...}`, and only Step 5 (the calling agent naming
    each community from its node contents) overwrites them with real names before
    `graphify-out/.graphify_labels.json` is finalized. If Step 5 is skipped or the session ends
    early, the placeholders silently persist into `graph.json`, `GRAPH_REPORT.md`, and
    `graph.html`'s sidebar/legend. The bare CLI `graphify update .` (what `DEPLOY.md` tells you to
    run after code changes) does **not** have this problem — it remaps new clusters onto old ones
    by node overlap and keeps whatever names already exist in `.graphify_labels.json`. Fix if it
    happens: read every community's node list out of `graphify-out/graph.json` (group nodes by the
    `community` field), write a 2-5 word semantic label per community into
    `graphify-out/.graphify_labels.json`, then re-run `graphify export html` and regenerate
    `graph.json`/`GRAPH_REPORT.md` via `graphify.export.to_json(..., community_labels=labels)` and
    `graphify.report.generate(...)` so all three outputs agree (2026-07-02).

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

36. **`Celery.autodiscover_tasks(["app.tasks"])` does not do what it looks like it does when the
    package name IS the tasks package itself.** By default `autodiscover_tasks` imports
    `<package>.tasks` for each entry (Django-app-style discovery) — passing `["app.tasks"]` makes
    it try to import `app.tasks.tasks`, which doesn't exist (the real modules are
    `app.tasks.feed_crawler`, `point_decay`, `draft_cleanup`), so it silently finds and registers
    **zero** tasks. Confirmed live on prod (2026-07-04, verifying the roles/permissions deploy):
    `celery -A app.tasks.celery_app worker` starts cleanly, connects to Redis, and logs an empty
    `[tasks]` block — no error, no crash — then every `celery-beat`-scheduled job (point decay, RSS
    crawl priorities 1-3, draft cleanup) fails at dispatch time with `Received unregistered task of
    type '...'` / `KeyError` in the worker log, **only surfacing whenever beat's schedule next
    fires**, not at worker startup. This predates the roles/permissions redesign (celery_app.py
    untouched by it, confirmed via `git log --follow`) — background jobs have likely never
    actually executed in prod since Celery was introduced.
    **FIXED 2026-07-05** (UI-backlog cleanup pass): replaced `autodiscover_tasks(["app.tasks"])`
    with explicit `from app.tasks import draft_cleanup, feed_crawler, point_decay` in
    `celery_app.py` (verified locally: `celery_app.tasks.keys()` now lists all three registered
    names before this fix it listed none). Deployed and confirmed live — see DEPLOY.md gotcha #12.
    To check if this ever regresses: `docker compose exec celery-worker python3 -c "from
    app.tasks.celery_app import celery_app; print(celery_app.tasks.keys())"` — if it only shows
    `celery.*` builtins, no real tasks are registered.

37. **A bash tool call backgrounding a compound `source .venv/bin/activate && setsid nohup uvicorn
    ... &` can report "terminated after exceeding timeout" even though the background process
    started successfully** — don't treat that timeout message as a failure signal by itself.
    Confirmed harmless: after the reported timeout, `ss -ltnp | grep 8001` already showed the new
    uvicorn PID correctly bound and `curl`-ing a fresh endpoint on it worked immediately. Always
    verify via `ss -ltnp`/a health-check request, not the tool call's own exit status, when
    backgrounding a multi-command chain this way. Separately, re-confirmed lesson #9's own
    "graceful shutdown hangs" behavior while restarting the backend for this same change: a plain
    `kill <pid>` (SIGTERM) can leave the *old* uvicorn process listed as still `Ssl`-alive in
    `ps aux` for a while even after the port has already been freed and a *new* process has
    successfully bound to it — `kill -9` on the old PID is what actually reaped it. Don't assume a
    freed port means the old process fully exited; check `ps -p <old_pid>` too before moving on.
    (Roles/permissions post-Phase-6 decisions — professional promote/demote + entity-conversion
     rank-cap/preview — restarting the backend dev server, 2026-07-04.)

38. **Always load relevant skills before working — the user added them for a reason.**
    The `tailwindcss-development` skill was added to the project explicitly documenting
    Tailwind v4 usage. It was never loaded during Content Studio development, so v3
    patterns were used throughout (`@tailwind` directives, `tailwind.config.ts`,
    `rgb(var(--token) / <alpha-value>)` hack). This caused a color format inconsistency
    (RGB channels in CSS vars vs hex in the palette picker) that broke the palette
    matching in the visual overlay. The user caught this and was rightfully frustrated.
    **Rule: check `.opencode/skills/` and `~/.config/opencode/skills/` at the start of
    every session. Load any skill that's relevant to the task. Do not assume you know
    the patterns — the skills exist to prevent exactly this.** (Content Studio v2
    Phase 4-6, 2026-07-09.)

39. **Never make technical decisions without consulting the user.**
    During Content Studio development, several decisions were made silently: using
    Tailwind v3 instead of v4, storing colors as RGB channels instead of hex, using
    an iframe for the overlay, building `InlineTextEditor` as a non-functional
    placeholder, keeping v1 dashboard pages without asking. The AGENTS.md already says
    "Never make technical decisions without consulting the user" but this was violated
    repeatedly. **When you encounter a decision point (framework version, data format,
    architectural pattern, dependency), stop and ask. Present options with trade-offs.
    Do not assume.** (Content Studio v2, 2026-07-09.)
