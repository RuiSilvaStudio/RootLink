# Module Reference

> All API modules and frontend pages with what they connect to.

## Backend API Modules

| Module | Prefix | Purpose | Key Dependencies |
|--------|--------|---------|-----------------|
| auth | `/api/auth` | Registration, login, profile | User model, JWT, bcrypt |
| users | `/api/users` | User search, entity directory, profiles | User model, Follow, GroupMember |
| content | `/api/content` | Article CRUD, bookmarks, search | Content, Bookmark, SearchQueryLog, embeddings |
| groups | `/api/groups` | Community groups, membership | Group, GroupMember, Follow |
| events | `/api/events` | Event management, RSVP, tickets, venues, sponsors, vendors, donations | Event + 8 sub-resource models, Group |
| comments | `/api/comments` | Polymorphic threaded comments | Comment (self-referencing), Notification |
| social | `/api/social` | Follow/unfollow, activity feed | Follow, User, Notification, SSE |
| notifications | `/api/notifications` | In-app notifications, SSE streaming | Notification, SSE manager |
| messages | `/api/messages` | Direct messaging | Conversation, ConversationParticipant, Message, Notification |
| learning | `/api/learning` | Courses, lessons, learning paths, enrollment | Course, Lesson, LearningPath, Enrollment, LessonProgress |
| plants | `/api/plants` | Plant database, calendar, irrigation, UTAD crawling | Plant, external APIs (iNaturalist, GBIF) |
| marketplace | `/api/marketplace` | Buy/sell/swap/free listings, Stripe payments | Listing, ListingOrder, SellerStripeAccount, Stripe |
| payments | `/api/payments` | Stripe webhook handler | Stripe, ListingOrder, Notification |
| images | `/api/images` | Image upload, processing, dedup, multi-size serving | ImageAsset, Pillow |
| taxonomy | `/api/taxonomy` | Hierarchical taxonomy (families → categories) | TaxonomyFamily, TaxonomyCategory |
| waste | `/api/waste` | Composting hubs, upcycling, waste challenges | CompostingHub, UpcyclingProject, WasteChallenge |
| admin | `/api/admin` | Admin panel: users, content, settings, broadcast, tickets/donations/sponsors/vendors | All models |
| crawl | `/api/crawl` | Content crawling/scraping | Content, httpx |
| external | `/api/external` | Moon phase, sun data, species search | httpx (external APIs) |
| checklist | `/api/checklist` | Monthly gardening checklists | ChecklistItem |
| farmers_guide | `/api/farmers-guide` | Seasonal farming task guide | Static/template-based |

## Frontend Pages

| Route | Component | Connects To |
|-------|-----------|-------------|
| `/` | Home | content (recent), groups, events |
| `/auth/login` | LoginPage | auth.login |
| `/auth/register` | RegisterPage | auth.register |
| `/search` | SearchPage | content.search, users.search, events.search, groups.search, plants.search |
| `/content/[id]` | ContentDetail | content.get, comments |
| `/groups` | GroupsList | groups.list |
| `/groups/[id]` | GroupDetail | groups.get, members, comments |
| `/events` | EventsList | events.list |
| `/events/[id]` | EventDetailPage | events.get, RSVP, venue, schedule, sponsors, vendors, donations, tickets, comments |
| `/marketplace` | Marketplace | marketplace.list |
| `/marketplace/create` | CreateListingPage | marketplace.create, images.upload |
| `/marketplace/[id]` | ListingDetail | marketplace.get, purchase, comments |
| `/marketplace/edit` | EditListingPage | marketplace.update |
| `/learning` | LearningHub | courses.list, paths.list |
| `/learning/courses/[id]` | CourseDetail | courses.get, lessons, enrollments |
| `/learning/courses/[id]/edit` | EditCoursePage | courses.update |
| `/learning/courses/new` | NewCoursePage | courses.create |
| `/learning/paths` | LearningPaths | paths.list |
| `/learning/paths/[id]` | PathDetail | paths.get, courses |
| `/plants` | PlantsList | plants.list |
| `/plants/[id]` | PlantDetail | plants.get, external (iNaturalist, GBIF) |
| `/composting` | CompostingPage | waste.hubs |
| `/upcycling` | UpcyclingPage | waste.upcycling |
| `/entities` | EntitiesPage | users.entities |
| `/network` | NetworkPage | users.match |
| `/feed` | FeedPage | social.feed |
| `/messages` | MessagesPage | messages.list, messages.get |
| `/notifications` | NotificationsPage | notifications.list |
| `/profile` | ProfilePage | auth.me, users.activity |
| `/profile/[id]` | UserProfilePage | users.get, users.activity |
| `/submit` | SubmitPage | content.submit |
| `/tools` | ToolsHub | — (static) |
| `/tools/gardening-calendar` | Calendar | plants.calendar |
| `/tools/monthly-checklist` | Checklist | checklist.list |
| `/tools/irrigation-calculator` | Calculator | plants.irrigation |
| `/admin` | AdminDashboard | admin.dashboard |
| `/admin/users` | AdminUsers | admin.users |
| `/admin/content` | AdminContent | admin.content |
| `/admin/review-queue` | ReviewQueue | admin.review |
| `/admin/groups` | AdminGroups | admin.groups |
| `/admin/comments` | AdminComments | admin.comments |
| `/admin/plants` | AdminPlants | admin.plants |
| `/admin/config` | AdminConfigPage | admin.settings |
| `/admin/tickets` | AdminTickets | admin.tickets |
| `/admin/donations` | AdminDonations | admin.donations |
| `/admin/sponsors` | AdminSponsors | admin.sponsors |
| `/admin/vendors` | AdminVendors | admin.vendors |

## Cross-Module Dependencies

### Auth Module
- Used by: all modules (via `get_current_user` / `get_optional_user`)
- Provides: user context, role checks, ownership verification
- Frontend: `lib/auth-context.tsx` wraps entire app

### SSE Manager
- Used by: notifications, social, messages, events (RSVP)
- Provides: real-time push to frontend
- Frontend: EventSource connection in NavBar, fallback to polling

### Image Service
- Used by: content, events, groups, courses, plants, marketplace, waste, admin
- Provides: upload, process, dedup, serve
- Frontend: `api.images.upload()`, `api.images.serve()`

### Search Service
- Used by: content, events, courses, lessons, groups, plants
- Provides: hybrid search (embeddings + keywords)
- Frontend: unified search page

### Taxonomy Service
- Used by: content, events, groups, courses, listings, upcycling
- Provides: family/category filtering
- Frontend: category grids, filter dropdowns

### Notification Service
- Created by: social (follow), events (RSVP), messages, comments
- Consumed by: notifications module, NavBar badge
- Frontend: SSE stream + polling fallback

### Stripe Service
- Used by: marketplace (purchase), payments (webhook)
- Provides: checkout sessions, seller onboarding, refunds
- Frontend: purchase flow, seller settings
