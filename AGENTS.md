## Lessons learned (read first)

**Before any dev or deploy work, read `docs/LESSONS.md`.** It captures hard-won,
non-obvious gotchas from past sessions (e.g. always run `next build` before a frontend
deploy; never `npm run build` while `next dev` is live; restart the backend after backend
changes; multi-worker lifespan migration races; SQLite/JSON-null pitfalls). When a new
gotcha bites, add it there in the same change. The content-platform work is documented in
`docs/content-platform/` (spec `CONTENT_PLATFORM.md`, status `IMPLEMENTATION_STATUS.md`).

## Deployment

`DEPLOY.md` is the single source of truth for deployment. It survives chat history loss.

Rules (follow all of them):
- **Before any deployment task, READ `DEPLOY.md` first** — server access, architecture, domains, secrets locations, and every hard-won gotcha live there, not in chat history.
- **To deploy, run `./scripts/deploy.sh`** from the repo root on `main`. It pushes to GitHub (triggering the Vercel frontend deploy), then SSHes to the server to back up the DB, pull, rebuild containers, run migrations, and health-check. Use `--no-push` to skip the git push.
- **The frontend deploys on Vercel** automatically from a push to `main`. The backend (FastAPI + Redis + Celery on 192.168.1.228) is what `deploy.sh` updates.
- **ALWAYS keep `DEPLOY.md` current.** If anything changes — server, domains, secrets, the deploy process, the compose file, env vars, or you hit a NEW gotcha worth remembering — update `DEPLOY.md` in the SAME change. Treat an out-of-date `DEPLOY.md` as a bug.
- Open tech debt and the planned Next.js 15 upgrade are tracked in `TECH_DEBT.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
