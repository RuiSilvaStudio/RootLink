---
name: platform-coherence
description: >
  Platform development coherence guide for RootLink. Ensures every code change
  is checked against the full architecture for ripple effects, permissions,
  security, privacy, and design consistency. Use this skill on ALL development
  tasks in the RootLink project — including feature work, bug fixes, refactors,
  database changes, API modifications, and UI updates. Always load this skill
  before making code changes, even if the task seems small. This skill prevents
  breaking changes, missed edge cases, and inconsistent implementations.
---

# Platform Coherence Skill

You are working on RootLink, a community platform for gardeners, makers, and homesteaders. This skill ensures every code change is coherent with the full platform architecture.

## Workflow

When the user asks you to make ANY code change:

### Step 1: Identify Change Type

Classify the task into one of these categories:

- **Add/remove/modify field** on a model
- **Add new entity type** (model, API, frontend page)
- **Change taxonomy value** (family/category strings)
- **Add notification type** (new trigger or display)
- **Modify payment flow** (Stripe integration)
- **Change image handling** (upload, serve, URL pattern)
- **Modify search** (add entity type, change ranking)
- **UI/component change** (page, layout, component)
- **API endpoint change** (route, auth, response shape)
- **Database migration** (schema change)

### Step 2: Load Relevant Reference

Read the appropriate reference file(s) for the change type:

| Change Type | Reference |
|-------------|-----------|
| Any code change | `references/architecture-overview.md` first |
| Model field change | `references/dependency-chains.md` — find the model |
| API endpoint | `references/module-reference.md` — find the module |
| Adding new feature | `references/module-reference.md` + `references/common-changes.md` |
| Auth/permission question | `references/permissions-rules.md` |
| Security concern | `references/security-rules.md` |
| User data/privacy | `references/privacy-rules.md` |
| UI pattern question | `references/design-patterns.md` |
| Any change with checklist | `references/common-changes.md` |

### Step 3: Cross-Reference with Graphify

Run graphify queries to find live dependencies:

```bash
# Find all files related to the module being changed
graphify query "what depends on [module/model name]"

# Find the shortest path between two components
graphify path "[Component A]" "[Component B]"

# Explain a concept and its neighbors
graphify explain "[module name]"
```

### Step 4: Provide Change Checklist

Before writing code, present a checklist of every file and module that needs updating. Use the dependency chains to ensure nothing is missed.

### Step 5: After Changes

Run these commands after any code change:

```bash
# Rebuild the knowledge graph (auto-runs on commit, but run manually for immediate feedback)
graphify update .

# Lint and type check
cd rootlink/backend && ruff check .
cd rootlink/frontend && npm run lint
```

## Rules

### Permission Rules
- **Role hierarchy:** admin > moderator > contributor > user
- Every entity has an owner — check ownership before allowing edits/deletes
- Admin routes use `require_role()` dependency factory
- User visibility is controlled by `visible_in_network` field
- See `references/permissions-rules.md` for module-specific access rules

### Security Rules
- Never log JWT tokens or secrets
- Always validate input with Pydantic schemas
- File uploads: validate type, enforce size limits, use content-addressed storage
- Rate limiting on auth and write endpoints
- CORS configured per environment
- See `references/security-rules.md` for details

### Privacy Rules
- Email addresses never exposed in API responses
- Location (lat/lng) only shown to authenticated users
- `visible_in_network` controls directory visibility
- Activity feed respects follower-only vs public content
- See `references/privacy-rules.md` for details

### Design Rules
- Earth/nature color theme (Tailwind tokens)
- Bilingual PT/EN — always use `t()` function for strings
- Framer Motion for page transitions
- Mobile-first responsive design
- See `references/design-patterns.md` for component patterns

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | App entry, all routers, all DB migrations |
| `backend/app/api/` | 21 API modules |
| `backend/app/models/` | Database models (SQLAlchemy) |
| `backend/app/schemas/` | Pydantic response/request schemas |
| `backend/app/services/` | Business logic |
| `frontend/lib/api.ts` | Frontend API client (737 lines) |
| `frontend/lib/auth-context.tsx` | Auth provider |
| `frontend/lib/locale-context.tsx` | i18n provider |
| `frontend/app/` | Next.js App Router pages |
| `frontend/components/` | Reusable UI components |
| `graphify-out/graph.json` | Live knowledge graph |
