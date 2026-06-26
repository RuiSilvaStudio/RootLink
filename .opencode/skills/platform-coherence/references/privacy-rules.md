# Privacy Rules

> What data is public vs private, user visibility, and data handling.

## Data Classification

### Public Data (visible to everyone)
- Published content (articles, events, courses)
- Group names and descriptions
- Event listings (public events)
- Plant database entries
- Marketplace listings (title, description, price, images)
- User display name and avatar (if visible_in_network)
- Taxonomy categories and families

### Semi-Public Data (visible to authenticated users)
- User location (city/region, not exact coordinates)
- Event details (private events with matching visibility_roles)
- User profiles with `visible_in_network = True`
- Entity directory (organizations, practitioners)

### Private Data (visible only to owner)
- Email address
- Exact location (lat/lng)
- Password hash (never exposed)
- Payment information (Stripe tokens, card numbers)
- Private messages
- Notification content
- Order history
- Checklist items
- Enrollment records

### Admin-Only Data
- User role assignments
- Site settings
- Content moderation queue
- Broadcast messages
- Audit logs

## User Data Rules

### Email Address
- Never returned in API responses to other users
- Only visible in user's own profile
- Used for authentication and notifications
- Stored hashed if not needed in plaintext

### Location
- `lat/lng` stored for distance calculations (nearby search, entity matching)
- Exact coordinates only returned to the user themselves
- Other users see approximate location (city/region)
- `visible_in_network = False` hides location from directory

### Profile Information
- `name`: public if `visible_in_network = True`
- `bio`: public if `visible_in_network = True`
- `skills` / `interests`: public if `visible_in_network = True`
- `avatar_url`: public (used in comments, feed, marketplace)
- `account_type` / `entity_type`: public for directory
- `certifications`: public for practitioners

### Activity Data
- Follow relationships: follower/following lists visible to the user
- RSVP data: visible to event creator and the user
- Comment history: visible on the entities where comments were made
- Purchase history: visible only to buyer and seller

## Entity Visibility Rules

### Events
- `visibility = "public"` → visible in event listings, search, calendar
- `visibility = "private"` → visible only to users with matching `visibility_roles`
- Creator can always see their own events
- RSVP data visible to event creator

### Content
- `verification_status = "published"` → visible to everyone
- `verification_status = "unreviewed"` → visible only to author and admins
- `verification_status = "cross_referenced"` → visible to author and moderators

### Groups
- Group names and descriptions: public
- Member lists: visible to authenticated users
- Group activity: visible to members

### Marketplace
- Listings: public (title, description, price, images)
- Seller information: public (name, avatar)
- Order details: visible only to buyer and seller
- Payment information: never exposed

## Data Retention

### Active Data
- User accounts retained while active
- Content retained while published
- Events retained while active or upcoming

### Soft Delete
- Users are not hard-deleted (referenced by many models)
- Content may be soft-deleted (marked as deleted but retained)
- Events may be cancelled but retained for history

### Data Export
- Users can request their data (GDPR compliance)
- Export includes: profile, content, events, orders, messages
- Format: JSON

## GDPR Considerations

### Consent
- Registration implies consent to data processing
- Privacy policy link on registration page
- Users can delete their account (soft delete)

### Right to Access
- Users can request full data export
- Admin can generate data export for any user

### Right to Erasure
- Account deletion request soft-deletes the account
- Personal data removed from public view
- Referenced data (content, events) retained but anonymized

### Data Portability
- Export in JSON format
- Include all user-generated content

## API Response Rules

### Never Expose
- Password hashes
- JWT tokens (except the one issued on login)
- Stripe secret keys or tokens
- Database connection strings
- Internal server errors with stack traces

### Always Sanitize
- User input (prevent XSS)
- HTML content (strip or escape)
- File names (prevent path traversal)
- Search queries (prevent injection)

### Pagination
- All list endpoints use pagination
- Default page size: 20 items
- Maximum page size: 100 items
- Return total count for UI display
