# Common Change Checklists

> Step-by-step checklists for frequent change types. Use these as templates.

## Add Field to Existing Model

- [ ] **Model:** Add column to `backend/app/models/[model].py`
- [ ] **Migration:** Add ALTER TABLE to `main.py` lifespan() with try/except
- [ ] **Schema:** Add to response/request model in `backend/app/schemas/[model].py`
- [ ] **API:** Update CRUD endpoints in `backend/app/api/[module].py`
- [ ] **API helper:** Update `_entity_to_response()` if it exists
- [ ] **Frontend client:** Update type shape in `frontend/lib/api.ts`
- [ ] **Frontend page:** Update display in `frontend/app/[entity]/`
- [ ] **Admin:** Update admin management in `backend/app/api/admin.py` if needed
- [ ] **Search:** Add to search function in `backend/app/services/search.py` if searchable
- [ ] **Notifications:** Check if field triggers notification creation
- [ ] **Graphify:** Run `graphify update .` after changes

## Add New API Endpoint

- [ ] **Router:** Create or update file in `backend/app/api/`
- [ ] **Model:** Create/update model in `backend/app/models/` if needed
- [ ] **Schema:** Create Pydantic schemas in `backend/app/schemas/`
- [ ] **Service:** Business logic in `backend/app/services/` if complex
- [ ] **Register:** Add router to `main.py` with `app.include_router()`
- [ ] **Auth:** Add `get_current_user` or `get_optional_user` dependency
- [ ] **Permissions:** Add role check with `require_role()` if admin-only
- [ ] **Frontend client:** Add function to `frontend/lib/api.ts`
- [ ] **Frontend page:** Create/update page in `frontend/app/`
- [ ] **Notifications:** Add notification creation if endpoint generates notifications
- [ ] **Graphify:** Run `graphify update .` after changes

## Add New Entity Type (Full Feature)

- [ ] **Model:** Create in `backend/app/models/[entity].py` with TimestampMixin
- [ ] **Schema:** Create in `backend/app/schemas/[entity].py`
- [ ] **API:** Create router in `backend/app/api/[entity].py`
- [ ] **Service:** Create in `backend/app/services/[entity].py` if complex
- [ ] **Register:** Add router to `main.py`
- [ ] **Migration:** Add CREATE TABLE + indexes to `main.py` lifespan()
- [ ] **Search:** Add to `hybrid_search` in `backend/app/services/search.py`
- [ ] **Comments:** Add entity_type to Comment model enum if comments needed
- [ ] **Notifications:** Add notification type if needed
- [ ] **Frontend client:** Add all CRUD functions to `frontend/lib/api.ts`
- [ ] **Frontend list page:** Create `frontend/app/[entity]/page.tsx`
- [ ] **Frontend detail page:** Create `frontend/app/[entity]/[id]/page.tsx`
- [ ] **Frontend create/edit:** Create forms if needed
- [ ] **Admin:** Add admin management in `backend/app/api/admin.py`
- [ ] **Admin UI:** Add admin page in `frontend/app/admin/`
- [ ] **Taxonomy:** Add `family` field if applicable
- [ ] **Images:** Add `image_url` field if applicable
- [ ] **Graphify:** Run `graphify update .` after changes

## Change Taxonomy Value

- [ ] **Family value:** Update `taxonomy_families` table
- [ ] **Categories:** Update all `taxonomy_categories` for that family
- [ ] **Backfill:** UPDATE all entities using old family value (groups, content, events, courses, listings)
- [ ] **Migration:** Add backfill to `main.py` lifespan()
- [ ] **Frontend:** Update category grids/lists in all affected pages
- [ ] **Search:** Update search filters
- [ ] **Admin:** Update taxonomy admin management
- [ ] **API:** Update any hardcoded family lists

## Add Notification Type

- [ ] **Enum:** Add type to Notification model enum in `backend/app/models/notification.py`
- [ ] **Create:** Add notification creation in relevant API handler
- [ ] **SSE:** Add `sse_manager.notify()` call
- [ ] **Frontend badge:** Update `frontend/components/NavBar.tsx` if type affects count
- [ ] **Frontend list:** Update `frontend/app/notifications/page.tsx` display
- [ ] **Email:** Check if type should trigger email (if email system exists)
- [ ] **Admin:** Update admin notification management

## Modify Payment Flow

- [ ] **Model:** Update `ListingOrder` in `backend/app/models/listing.py` if order fields change
- [ ] **Checkout:** Update `backend/app/services/stripe_payments.py`
- [ ] **API:** Update `backend/app/api/marketplace.py` (create order, decrement quantity)
- [ ] **Webhook:** Update `backend/app/api/payments.py` (payment success/failure/refund)
- [ ] **Frontend client:** Update purchase/claim functions in `frontend/lib/api.ts`
- [ ] **Frontend UI:** Update `frontend/app/marketplace/[id]/` purchase flow
- [ ] **Admin:** Update admin ticket/donation management
- [ ] **Quantity:** Verify quantity decrement/restore logic is correct

## Change Image URL Pattern

- [ ] **Service:** Update `backend/app/api/images.py` (serve, by-hash endpoints)
- [ ] **Models:** Update all models with `image_url` fields (10+ models)
- [ ] **Frontend client:** Update image URL construction in `frontend/lib/api.ts`
- [ ] **Frontend components:** Update all components rendering images
- [ ] **Social sharing:** Update Open Graph image URLs
- [ ] **Crawled content:** Update image URL handling in crawl service

## Add Searchable Entity

- [ ] **Search:** Add entity to `hybrid_search` in `backend/app/services/search.py`
- [ ] **Embeddings:** Generate embeddings for existing entities
- [ ] **API:** Add search results to search endpoint response
- [ ] **Frontend client:** Update search response handling in `frontend/lib/api.ts`
- [ ] **Frontend UI:** Update search results display
- [ ] **Filters:** Add category/filter for new entity type
- [ ] **Trending:** Add to trending searches if applicable
