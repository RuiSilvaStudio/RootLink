# RootLink 🌱

> Connect with the land, connect with each other.

A specialized search engine and community platform for gardeners, woodworkers, builders, and homesteaders. Discover meaningful content, events, learning resources, and like-minded people.

## Architecture

- **Frontend**: Next.js 14 (App Router, Tailwind CSS, PWA-capable)
- **Backend**: Python FastAPI (async, RESTful)
- **Database**: PostgreSQL 16 + pgvector (hybrid search)
- **Crawler**: Scrapy + Playwright
- **Search**: Hybrid keyword (tsvector) + semantic (pgvector embeddings)

## Quick Start

```bash
# Start all services
docker-compose up -d

# Backend API at http://localhost:8000
# Frontend at http://localhost:3000
# OpenAPI docs at http://localhost:8000/docs
```

Or run locally:

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Database:**
```bash
docker run -d --name rootlink-db \
  -e POSTGRES_DB=rootlink \
  -e POSTGRES_USER=rootlink \
  -e POSTGRES_PASSWORD=rootlink_dev \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

## Crawling Content

```bash
cd backend
scrapy crawl gardening
scrapy crawl woodworking
scrapy crawl building
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| PATCH | /api/auth/me | Update profile |
| GET | /api/content/search | Hybrid search |
| GET | /api/content/recent | Recent content |
| POST | /api/content/index | Index new content |
| POST | /api/content/bookmarks | Bookmark content |
| GET | /api/groups/ | List groups |
| POST | /api/groups/ | Create group |
| GET | /api/events/ | List events |
| POST | /api/events/ | Create event |

## Roadmap

- [x] Phase 1: Core search + auth
- [ ] Phase 2: Community (groups, discussions, follows)
- [ ] Phase 3: Events & learning paths
- [ ] Phase 4: Network (friend matching, map, messaging)
- [ ] Phase 5: Mobile (React Native)
