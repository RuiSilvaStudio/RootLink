# RootLink 🌱

> Connect with the land, connect with each other.

A specialized search engine and community platform for gardeners, woodworkers, builders, and homesteaders. Discover meaningful content, events, learning resources, and like-minded people.

## Architecture

- **Frontend**: Next.js 14 (App Router, Tailwind CSS, i18n pt/en)
- **Backend**: Python FastAPI (async, RESTful, SQLite)
- **Database**: SQLite + aiosqlite (dev); PostgreSQL + pgvector planned for prod
- **Crawler**: httpx + BeautifulSoup (UTAD plants), DuckDuckGo SDK (web)
- **Search**: Hybrid keyword (SQLite FTS5) + semantic (sentence-transformers, numpy)
- **Verification**: Embedding-based cross-referencing (cosine similarity ≥0.85, 3+ sources)

## Quick Start

Use the launcher script from the repo root:

```bash
./start.sh
```

Or start services individually:

**Backend:**
```bash
cd rootlink/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd rootlink/frontend
npm install
npm run dev
```

- API at http://localhost:8000
- Docs at http://localhost:8000/docs
- Frontend at http://localhost:3000

## Admin Seed

| Email | Password | Role |
|-------|----------|------|
| admin@rootlink.app | admin123 | admin |

## Plant Database

52 plants with sow/transplant/harvest windows, UTAD images, FAO-56 crop coefficients, and 4 Portuguese climate zones:

| Zone | Shift | Description |
|------|-------|-------------|
| Cool | +1 month | Interior Norte, Serra |
| Moderate | 0 | Litoral Centro/Norte |
| Warm | −1 month | Vale do Tejo, Alentejo |
| Hot | −2 months | Algarve, Madeira |

## Smart Tools

- **Irrigation Calculator** — ETo × Kc × area / efficiency − rain adjustment
- **Gardening Calendar** — month-by-month, zone/type filters, detail cards
- **Monthly Checklist** — auth-gated personal checklist + public Farmers Guide

## Farmers Guide

309 bilingual (PT/EN) tasks across 12 months, 11 categories. Public endpoint `GET /api/farmers-guide?month=N&locale=pt|en` (no auth required).

## API Endpoints (key)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET/POST | /api/content/search | Hybrid search |
| GET/POST | /api/content | CRUD content |
| GET/POST | /api/groups | List / create groups |
| GET/POST | /api/events | List / create events |
| GET/POST | /api/plants | Plant database CRUD |
| GET | /api/plants/calendar | Calendar (zone-aware) |
| POST | /api/checklist/presets | Generate checklist |
| GET | /api/checklist | View checklist |
| GET | /api/farmers-guide | Public farmers guide |
| GET/POST | /api/crawl | Web / UTAD crawl |
| GET/POST | /api/admin/* | Admin panel |

## Roadmap

- [x] Auth, search, content, groups, events (Phases 1-4)
- [x] Nested comments, follow/unfollow, notifications, DMs
- [x] Learning (courses, lessons, paths), network (match/nearby)
- [x] Admin panel: user/group/content/comment management, broadcast
- [x] Verification: auto cross-referencing, review queue
- [x] Web crawl, UTAD plant image crawl
- [x] Plant database (52 species, FAO-56, UTAD images)
- [x] Irrigation calculator, gardening calendar, monthly checklist
- [x] Farmers guide (309 tasks, bilingual PT/EN)
- [x] i18n (pt/default, en fallback)
- [ ] Content editor (rich text / markdown)
- [ ] Targeted broadcast by role, activity log, dashboard charts
- [ ] GitHub Actions CI
- [ ] Mobile (React Native or enhanced PWA)
