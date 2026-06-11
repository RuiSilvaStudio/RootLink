# HomeOwnersPortal

Monorepo for the RootLink platform — a specialized search engine and community platform for gardeners, makers, tradespeople, and homesteaders.

**Project source is in `/rootlink`** — see [rootlink/README.md](rootlink/README.md) for full documentation.

## Structure

```
├── rootlink/
│   ├── backend/     # Python FastAPI + SQLite
│   ├── frontend/    # Next.js 14 (App Router, Tailwind)
│   ├── scripts/     # Seed and utility scripts
│   └── README.md    # Full project docs
├── start.sh         # Development launcher
└── .gitignore
```

## Tech

- **Frontend:** Next.js 14, Tailwind CSS, i18n (pt / en)
- **Backend:** FastAPI, SQLite, sentence-transformers (hybrid search)
- **Database:** SQLite (dev), designed for PostgreSQL + pgvector (production)
