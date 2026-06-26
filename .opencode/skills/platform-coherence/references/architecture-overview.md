# Architecture Overview

> Last updated: 2026-06-22

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | FastAPI + SQLAlchemy (async) | Python 3.12+ |
| Database | SQLite (aiosqlite) | — |
| Frontend | Next.js (App Router) + React | 14 / 18 |
| Styling | Tailwind CSS | 3.4 |
| Animation | Framer Motion | 12 |
| Icons | lucide-react | — |
| i18n | Custom locale context (static JSON) | PT/EN |
| Auth | JWT (python-jose) + bcrypt (passlib) | — |
| Payments | Stripe Connect | — |
| Search | sentence-transformers (all-MiniLM-L6-v2) + keyword | — |
| Images | Pillow, content-addressed WebP storage | — |
| PWA | next-pwa | 5.6 |
| Linting | ruff (backend), eslint 8 (frontend) | — |
| Deployment | Docker (backend) + Vercel (frontend) | — |

## Directory Structure

```
rootlink/
├── backend/
│   ├── app/
│   │   ├── main.py              # App entry, 21 routers, all DB migrations
│   │   ├── api/                  # 21 API modules
│   │   ├── models/               # SQLAlchemy models (18 files)
│   │   ├── schemas/              # Pydantic schemas (16 files)
│   │   ├── services/             # Business logic (16 files)
│   │   └── core/                 # config, database, security, logging, rate_limit
│   ├── pyproject.toml
│   └── Dockerfile.prod
├── frontend/
│   ├── app/                      # Next.js App Router (23 page directories)
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Primitives (Button, Card, Badge, etc.)
│   │   ├── search/               # Search components
│   │   └── [feature]/            # Feature-specific components
│   ├── lib/
│   │   ├── api.ts                # API client (737 lines)
│   │   ├── auth-context.tsx      # Auth provider
│   │   └── locale-context.tsx    # i18n provider
│   ├── messages/                 # PT/EN translation JSONs
│   └── package.json
├── docker-compose.prod.yml
└── .env
```

## Database Models

### Core Entity: User
Central entity. Referenced by nearly every other model.

**Fields:** id, email, name, password_hash, bio, location, lat/lng, skills (JSON), interests (JSON), avatar_url, role (enum), visible_in_network, locale, account_type (enum), entity_type, registration_number, services (JSON), service_area, certifications (JSON), modality, is_verified, verified_at

**Enums:** UserRole (admin/moderator/contributor/user), AccountType (individual/organization/practitioner), EntityType

### Content
Articles, indexed content. Supports hybrid search (embeddings + keywords).

**Fields:** id, title, url, content_type (article/event/course/forum/video), category, family, full_text, summary, embedding (JSON), image_url, source (crawled/user/curated), source_url, created_by (FK→User), published_at, crawled_at, verification_status, validated_by, cross_referenced_sources (JSON)

**Related:** Bookmark (user_id, content_id), SearchQueryLog

### Event
Full event management with 8 sub-resource tables.

**Fields:** id, title, description, date, end_date, location, url, image_url, is_online, category, family, max_attendees, group_id (FK→Group), created_by (FK→User), visibility, visibility_roles, status, ticket_type, ticket_price, ticket_tiers, currency, donation_goal, description_long, contact_email/phone, requirements, tags, image_gallery, recurrence_type, recurrence_config

**Sub-resources:** EventRSVP, EventVenue, EventAmenity, EventSchedule, EventSponsor, EventVendor, EventDonation, EventTicket

### Group
Community groups with membership.

**Fields:** id, name, slug (unique), description, category, family, created_by (FK→User), image_url

**Related:** GroupMember (group_id, user_id, role: member/moderator/admin)

### Plant
Plant database with external data enrichment (iNaturalist/GBIF).

**Fields:** id, scientific_name (unique), scientific_name_full, common_names_pt/en (JSON), genus, family, order_name, class_name, division, plant_type, growth_form/habit, height_cm, flowering_start/end, days_to_maturity_min/max, sow/transplant/harvest_month ranges, usda_zone_min/max, chill_hours, sun_requirement, soil_ph, soil_texture, kc_initial/mid/late, root_depth_cm, row/plant spacing, sowing_depth/method, habitat, distribution_portugal, pests (JSON), sources (JSON), image_url, source_url, notes

### Course, Lesson, LearningPath
Full LMS module.

**Course fields:** id, title, description, category, family, image_url, created_by (FK→User), is_published
**Lesson fields:** id, course_id (FK→Course), title, content, video_url, order, duration_minutes
**LearningPath fields:** id, title, description, image_url, created_by (FK→User)
**LearningPathCourse:** path_id, course_id, order

### Listing (Marketplace)
Buy/sell/swap/free listings with Stripe Connect payments.

**Fields:** id, title, description, price, currency, category, family, listing_type (buy/sell/swap/free), condition, image_url, seller_id (FK→User), quantity, is_available, status

**Related:** ListingOrder (listing_id, buyer_id, quantity, total, status, stripe_session_id), SellerStripeAccount (user_id, stripe_account_id, onboarding_status)

### Comment
Polymorphic threaded comments on any entity type.

**Fields:** id, content, entity_type (content/event/group/plant/course/lesson), entity_id, user_id (FK→User), parent_id (FK→Comment, self-reference for threading)

### Notification
In-app notifications with SSE streaming.

**Fields:** id, user_id (FK→User), type (follow/comment/reply/group_join/event_rsvp/system/message), actor_name, entity_type, entity_id, message, is_read, created_at

### CompostingHub, UpcyclingProject, WasteChallenge
Waste management module.

**CompostingHub fields:** id, name, description, location, lat/lng, created_by (FK→User)
**CompostingMember:** hub_id, user_id, role
**CompostingDeposit:** hub_id, user_id, waste_type, weight_kg, notes

### ImageAsset
Content-addressed image storage with multi-size WebP normalization.

**Fields:** id, hash (SHA-256, unique), original_path, large_path, medium_path, thumb_path, width, height, content_type, source_type (upload/crawl/api_inaturalist/api_utad/manual_url), author, license, attribution

### Taxonomy
Hierarchical taxonomy: Family → Category.

**TaxonomyFamily fields:** value (unique), label_en, label_pt, icon, description
**TaxonomyCategory fields:** value, family_value (FK→TaxonomyFamily), label_en, label_pt

### Other Models
- **ChecklistItem:** Monthly gardening checklists per user
- **Setting:** Key-value admin settings
- **SearchQueryLog:** Trending search tracking
- **Enrollment, LessonProgress:** Learning progress tracking

## Foreign Key Map

```
User ← created_by ← Content, Event, Group, Course, LearningPath, CompostingHub, UpcyclingProject, WasteChallenge
User ← user_id ← Bookmark, Comment, Notification, Follow, GroupMember, EventRSVP, EventTicket, EventDonation, CompostingMember, CompostingDeposit, ConversationParticipant, Enrollment, ChecklistItem
User ← seller_id ← Listing, ListingOrder
User ← buyer_id ← ListingOrder
Event ← event_id ← EventRSVP, EventVenue, EventAmenity, EventSchedule, EventSponsor, EventVendor, EventDonation, EventTicket
Group ← group_id ← GroupMember, Event (optional)
Course ← course_id ← Lesson, Enrollment, LearningPathCourse
LearningPath ← learning_path_id ← LearningPathCourse
CompostingHub ← hub_id ← CompostingMember, CompostingDeposit
Listing ← listing_id ← ListingOrder
Comment ← parent_id ← Comment (self-reference for threading)
```

## Key Patterns

### Authentication
- JWT tokens with bcrypt password hashing
- `get_current_user` dependency injects authenticated user
- `get_optional_user` for public endpoints with optional auth
- Token stored in frontend localStorage as `"token"`

### Payments (Stripe Connect)
- Marketplace purchases → Stripe Checkout Sessions
- Seller onboarding → Stripe Express Accounts with Account Links
- Webhook at `/api/payments/webhook` handles: payment success, failure, refunds
- Quantity decremented on purchase attempt, restored on failure

### Image Processing
- Content-addressed storage (SHA-256 hash)
- Automatic WebP normalization of all uploads
- Multi-size: original, large, medium, thumb
- Deduplication by hash
- Provenance tracking: source_type, author, license, attribution

### Search
- Hybrid: cosine similarity (embeddings) + keyword matching
- Searches across: Content, Event, Course, Lesson, Group, Plant
- Embeddings stored as JSON arrays
- Query logging for trending searches

### Real-Time Notifications
- SSE via `sse_manager` service
- Notifications created inline in API handlers
- Frontend falls back to polling every 30s on SSE error

### Database Migrations
- **No Alembic** — inline ALTER TABLE in `main.py` lifespan()
- Wrapped in try/except for idempotency
- Will not scale well — plan to migrate to Alembic eventually
