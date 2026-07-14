## Responses

- Keep responses concise and to the point - unless the user asks otherwise
- **The user is the product owner, not an engineer.** Explain decisions and ask questions in plain English with concrete examples. Ask about the goal/outcome, never the implementation technique. When presenting options, describe what each one means for a human using the product — not what the code looks like. Save technical detail for implementation notes.

## Planning Mode

- **Always ask** clarifying questions
- **Never assume** design, tech stack or features

## Lessons learned \(read first\)

**Before any dev or deploy work, read** `docs/LESSONS.md`**.** It captures hard-won,
non-obvious gotchas from past sessions \(e.g. always run `next build` before a frontend
deploy; never `npm run build` while `next dev` is live; restart the backend after backend
changes; multi-worker lifespan migration races; SQLite/JSON-null pitfalls\). When a new
gotcha bites, add it there in the same change. The content-platform work is documented in
`docs/content-platform/` \(spec `CONTENT_PLATFORM.md`, status `IMPLEMENTATION_STATUS.md`\).

**The Content Studio** \(the unified CMS-like tool managing RootLink's UI theming + content/copy\)
is documented in `docs/content-studio/` \(spec `CONTENT_STUDIO.md`, status
`IMPLEMENTATION_STATUS.md`\). **Before any Content Studio work, read the spec first** — it is the
north-star contract and anti-drift mechanism. A **UI face-lift review** was conducted and
implemented (2026-07-12, report + plan in `discovery/assessment/content-studio-facelift-*`); the
studio now has a collapsible sidebar, Cmd+K command palette, Sonner toasts, and a rebuilt
Overview page.

**The Self-Sufficient Platform guide** \(`docs/self-sufficient-platform/GUIDE.md`\) is the
north-star contract for platform self-sufficiency: every feature ships full-circle \(end-user
surface + owner/manager surface + adjustment surface that a non-dev can retune without a
deploy\). **Before any feature, fix, or expansion work, read this guide first** — walk the
per-feature rubric in §6. Non-goals \(multi-tenancy, custom domains, page export, a full
generic block library as a project\) are explicit in §5; don't let future sessions suggest
them as "natural next steps."

**The old inline Content UI Editor \(`components/editor-mode/`\) is RETIRED** — superseded by the
Content Studio's visual overlay \(`components/overlay/`\). Never wire new pages into `EditableText`/
`EditableImage`/`EditableIcon`. Editable copy now uses the `<Text k="copy.key">` convention \(see
"Editable copy convention" below\). Overlay coverage is added page by page, not automatically.
**Whenever you add a new frontend page, or new static marketing/header copy to an existing page,
ask the user whether it should be wired in — never assume either way.** See
`.opencode/skills/platform-coherence/references/design-patterns.md` → "Content Studio overlay &
editable copy" for the wiring pattern.

## UI work — required skills

**Any time, in any session, when building or modifying UI for this project,
always load and use both the **`frontend-design`** and **`frontend-ui-guardian
`**skills** — invoke the `skill` tool for both before writing UI code, not just
when explicitly asked. This applies to new pages, new components, and edits
to existing UI alike. `frontend-design` guides aesthetic/typography choices
so new UI doesn't read as templated defaults; `frontend-ui-guardian` is the
constitution for RootLink's frontend (Invisible Infrastructure, accessibility,
community autonomy) and should be treated as authoritative for any design
decision that conflicts with a generic default.

**Brand override for `frontend-design`:** that skill's calibration list warns against a
"warm cream background + high-contrast serif display + terracotta accent" as an AI-default
look. **That combination IS RootLink's established brand** \(cream `#f8f6f2`, Fraunces +
Source Serif 4, rust terracotta\) — chosen deliberately, not as a default. NEVER "fix" or
drift away from this identity to seem less templated. Additionally, its "take one aesthetic
risk" guidance applies only to public marketing surfaces — **never to back-office/tool UI**
\(Content Studio, admin, dashboards\), where consistency is the design; for those surfaces
the `frontend-ui-guardian` skill's "Back-Office / Tool UI" chapter is authoritative.

**Always load the `tailwindcss-development` skill before any CSS/styling work.**
This project uses **Tailwind CSS v4** (CSS-first configuration with `@theme`).
NEVER use v3 patterns: no `@tailwind base/components/utilities` directives, no
`tailwind.config.ts` JS config file, no `rgb(var(--token) / <alpha-value>)` hack.
Use `@import "tailwindcss"` and `@theme { --color-*: #hex; }` instead. Colors
are stored as hex (readable), and Tailwind v4 handles CSS variables + opacity
modifiers natively. If you catch yourself writing v3 patterns, stop and use v4.

**Unified UX contract (2026-07-11, binding for ALL new development):** the platform's UX was
unified in a full hardening pass \(report: `discovery/assessment/content-studio-ux-review.md`\).
Every new page, component, or feature — front-office and back-office — must follow the
established patterns instead of re-inventing them: the `frontend-ui-guardian` skill's
"Back-Office / Tool UI" chapter \(incl. its "implemented vocabulary" table and keyboard
contract\) is **binding** for studio/admin/dashboard work, and
`.opencode/skills/platform-coherence/references/design-patterns.md` → "Content Studio &
back-office UI patterns" lists the concrete components/hooks to reuse \(Modal, LoadError,
useDirtyGuard, Tooltip, Toaster/Sonner, skeletons, confirmations, debounce, optimistic updates, 12px floor\).
The checklist in `references/common-changes.md` → "Add or modify Studio/back-office UI" must
be walked for any such change. Never ship a destructive action without a confirm, a dirty
state without an exit guard, a fetch without loading/error/empty states, or a keyboard
shortcut without checking the keyboard contract.

**Never make technical decisions without consulting the user.** This includes
framework choices, data formats, architectural patterns, and dependency
additions. Present options with trade-offs and ask — do not assume.

## Directory Routing Map

- `discovery/research/` Technical spikes, third-party API evaluation, and architectural ideas.
- `discovery/assessment/` Stress test, security audits, and breaking/change impact report.
- `discovery/mockups/`Schema drafts, JSON payloads, and UI/UX sandbox code.
- `discovery/business/` Business Models, goals, monetization strategies, and vision documents.

## Guardrails & Safety Rules

1. **Context Isolation**: When evaluating new ideas, read rootlink/ for context, but dump all thoughts, research, and code drafts into /discovery.
2. **Idempotency**: Never alter existing database schemas or core business logic in rootlink/ during ideation or research phase.

## Editable copy convention

**All editable marketing/copy text must use the `<Text k="copy.key">` component** (`components/ui/Text.tsx`). It auto-marks the element with `data-rl-text="copy.key"` so the Content Studio overlay knows the text is editable + its copy key (for persisting edits via `/api/copy`). Render plain `{t("key")}` inside `<Text>` as children, or let `<Text>` render it automatically.

**Computed values** (counts, prices, dates, usernames, API data) are rendered with plain `{expr}` — no `<Text>`, no `data-rl-text`. The overlay treats these as read-only ("Computed value — not editable"). This is the distinction: editable copy = keyed = `<Text>`; computed = unkeyed = read-only. When building a new page, use `<Text>` for headings/subtitles/labels/buttons that are static copy, and leave dynamic values untagged.

`SectionHeader` accepts `headingKey`, `LinkWithArrow` accepts `copyKey`, `Button` forwards `data-rl-text` via `{...props}` — use these for text inside DeFacto/Button components.

## Deployment

`DEPLOY.md` is the single source of truth for deployment. It survives chat history loss.

Rules \(follow all of them\):

- **Before any deployment task, READ** `DEPLOY.md` **first** — server access, architecture, domains, secrets locations, and every hard-won gotcha live there, not in chat history.
- **To deploy, run** `./scripts/deploy.sh` from the repo root on `main`. It pushes to GitHub \(triggering the Vercel frontend deploy\), then SSHes to the server to back up the DB, pull, rebuild containers, run migrations, and health-check. Use `--no-push` to skip the git push.
- **The frontend deploys on Vercel** automatically from a push to `main`. The backend \(FastAPI + Redis + Celery on 192.168.1.228\) is what `deploy.sh` updates.
- **ALWAYS keep** `DEPLOY.md` **current.** If anything changes — server, domains, secrets, the deploy process, the compose file, env vars, or you hit a NEW gotcha worth remembering — update `DEPLOY.md` in the SAME change. Treat an out-of-date `DEPLOY.md` as a bug.
- Open tech debt and the planned Next.js 15 upgrade are tracked in `TECH_DEBT.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH\_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH\_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current \(AST-only, no API cost\).
