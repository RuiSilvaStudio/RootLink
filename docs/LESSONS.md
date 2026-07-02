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
