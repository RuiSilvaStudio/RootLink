# Dependency Chains

> What ripples when you change X. Use this to build checklists before making changes.

## User Model Changes

The User model is referenced by nearly every other model. Changes here have the widest ripple.

**Fields that ripple widely:**
- `name` → notifications (actor_name), social feed, marketplace (seller_name), events (attendee display), comments, messages
- `role` → admin access checks, role-based visibility, moderation permissions
- `avatar_url` → all user display components, notifications, comments, marketplace
- `location` / `lat/lng` → nearby search, entity directory, event locations
- `visible_in_network` → entity directory, user search, network page
- `skills` / `interests` → network matching, profile display
- `locale` → i18n preference, notification language

**Files to update:**
- [ ] `backend/app/models/user.py` — model definition
- [ ] `backend/app/schemas/user.py` — Pydantic response/request schemas
- [ ] `backend/app/api/auth.py` — registration, profile update
- [ ] `backend/app/api/users.py` — user search, entity directory
- [ ] `backend/app/api/admin.py` — admin user management
- [ ] `frontend/lib/api.ts` — User type shape
- [ ] `frontend/app/profile/` — profile pages
- [ ] `frontend/app/admin/users/` — admin user management
- [ ] `frontend/components/NavBar.tsx` — user display
- [ ] Any component displaying user info (comments, feed, marketplace)

## Event Model Changes

Events have the most sub-resources (8 related tables).

**Fields that ripple widely:**
- `title`, `description` → event list, detail, social feed, notifications
- `date` / `end_date` → calendar, schedule display, recurring events
- `visibility` / `visibility_roles` → access control, event listing filter
- `status` → event listing filter, RSVP logic, ticket sales
- `family` → taxonomy filtering, category display
- `image_url` → event list cards, detail page, social sharing

**Files to update:**
- [ ] `backend/app/models/event.py` — model + all sub-resource models
- [ ] `backend/app/schemas/event.py` — Pydantic schemas
- [ ] `backend/app/api/events.py` — CRUD + `_event_to_response()` helper + all sub-resource endpoints
- [ ] `backend/app/api/admin.py` — event admin, ticket management
- [ ] `frontend/lib/api.ts` — Event type shape
- [ ] `frontend/app/events/[id]/EventDetailPage.tsx` — detail display
- [ ] `frontend/app/events/` — list page
- [ ] Social feed (activity events)

## Taxonomy Changes

Taxonomy `family` value is stored as a string in 6+ models.

**Models using `family` field:** groups, content, events, courses, listings, upcycling_projects

**Changing a family value requires:**
- [ ] Update `taxonomy_families` table
- [ ] Update all `taxonomy_categories` for that family
- [ ] Backfill: update all entities using the old family value
- [ ] Update `CATEGORY_TO_FAMILY_MAP` migration in `main.py`
- [ ] Update frontend category displays
- [ ] Update search filters
- [ ] Update admin taxonomy management

**Adding a new family requires:**
- [ ] Insert into `taxonomy_families`
- [ ] Insert categories into `taxonomy_categories`
- [ ] Update frontend category grids/lists
- [ ] Update any hardcoded family lists in API or frontend

## Comment System Changes

Comments are polymorphic (entity_type + entity_id) and threaded (parent_id).

**Entity types with comments:** content, event, group, plant, course, lesson

**Changing the Comment model affects:**
- [ ] `backend/app/models/comment.py`
- [ ] `backend/app/api/comments.py`
- [ ] All entity detail pages (content, events, groups, plants, courses, lessons)
- [ ] Social feed (comment previews)
- [ ] Admin comment moderation
- [ ] Notification generation (comment + reply notifications)
- [ ] `frontend/components/CommentSection.tsx`

## Notification Changes

Notifications are created inline in multiple API handlers.

**Where notifications are created:**
- `backend/app/api/social.py` — follow notifications
- `backend/app/api/events.py` — RSVP notifications
- `backend/app/api/messages.py` — new message notifications
- `backend/app/api/comments.py` — comment + reply notifications

**Adding a new notification type:**
- [ ] Add type to Notification model enum
- [ ] Create notification in the relevant API handler
- [ ] Update `sse_manager.notify()` call
- [ ] Update frontend notification display
- [ ] Update `frontend/components/NavBar.tsx` badge
- [ ] Update `frontend/app/notifications/` page

## Image System Changes

Images are referenced by `image_url` in many models.

**Models with `image_url`:** Content, Event, Group, Course, Plant, CompostingHub, UpcyclingProject, WasteChallenge, EventSponsor, Listing

**Changing image storage/serving affects:**
- [ ] `backend/app/api/images.py` — upload, serve, hash endpoints
- [ ] `backend/app/models/image_assets.py` — ImageAsset model
- [ ] All models with `image_url` fields
- [ ] Frontend image components (any component rendering images)
- [ ] Frontend API client image upload functions
- [ ] Social sharing (Open Graph image URLs)

## Payment Flow Changes

Stripe payment flow touches 3+ files.

**Flow:** marketplace.py → stripe_payments.py → payments.py (webhook)

**Changing the order model or Stripe integration:**
- [ ] `backend/app/api/marketplace.py` — create order, decrement quantity
- [ ] `backend/app/services/stripe_payments.py` — create checkout session
- [ ] `backend/app/api/payments.py` — webhook handler
- [ ] `backend/app/models/listing.py` — ListingOrder model
- [ ] `frontend/lib/api.ts` — purchase/claim functions
- [ ] `frontend/app/marketplace/[id]/` — purchase flow UI
- [ ] `frontend/app/marketplace/` — listing display
- [ ] Admin ticket/donation management

## Search Index Changes

`hybrid_search` in `services/search.py` queries across 6 entity types.

**Adding a new searchable entity:**
- [ ] Add entity to `hybrid_search` function
- [ ] Generate embeddings for existing entities
- [ ] Update `frontend/lib/api.ts` search response handling
- [ ] Update search UI results display
- [ ] Update search filters/categories
- [ ] Add to trending searches if applicable

## API Client Changes (`api.ts`)

Every backend endpoint change requires a corresponding update in `api.ts`.

**Since the frontend uses `any` types, there is no compile-time safety.** Breaking changes can silently break the UI.

**When changing any API response shape:**
- [ ] Update `frontend/lib/api.ts` — the typed function return
- [ ] Find every frontend page/component consuming that endpoint
- [ ] Verify the UI still renders correctly
- [ ] Consider adding TypeScript interfaces for critical types

## Database Migration Changes

Migrations are inline in `main.py` lifespan().

**When changing the database schema:**
- [ ] Update the model in `backend/app/models/`
- [ ] Add ALTER TABLE to `main.py` lifespan() with try/except
- [ ] Test that existing data survives the migration
- [ ] Update any seed data scripts
- [ ] Consider eventual Alembic migration
