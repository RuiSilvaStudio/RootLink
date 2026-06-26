# Security Rules

> Authentication, input validation, file handling, and API security patterns.

## Authentication

### JWT Token Flow
1. User logs in → `POST /api/auth/login` → returns JWT token
2. Frontend stores token in `localStorage` as `"token"`
3. Every API request includes `Authorization: Bearer <token>` header
4. Backend validates token with `get_current_user` dependency

### Password Security
- Passwords hashed with bcrypt via passlib
- Never store plaintext passwords
- Never log password hashes
- Registration: `POST /api/auth/register` hashes before storage
- Login: `POST /api/auth/login` verifies with `verify_password()`

### Token Rules
- Never log JWT tokens in production
- Token contains user ID and role
- Token expiry configured in `backend/app/core/config.py`
- Frontend: token read from `localStorage` on app mount
- Logout: clear token from `localStorage`

## Input Validation

### Pydantic Schemas
- Every API endpoint uses Pydantic schemas for request validation
- Invalid input returns 422 with detailed error messages
- Schemas defined in `backend/app/schemas/`

### Common Validation Patterns
- Email format validation on registration
- Password strength requirements
- String length limits on text fields
- Numeric range validation on prices, quantities
- Enum validation on status fields, roles, categories
- JSON field validation for arrays (skills, interests, tags)

### SQL Injection Prevention
- SQLAlchemy ORM parameterizes all queries
- Never use raw SQL with string formatting
- Use `text()` with bound parameters for raw queries: `text("SELECT * FROM users WHERE id = :id"), {"id": user_id}`

## File Upload Security

### Image Upload
- Validate file type (MIME type check)
- Enforce size limit (configured in `core/config.py`)
- Content-addressed storage (SHA-256 hash) prevents path traversal
- Automatic WebP normalization strips metadata
- Deduplication by hash prevents duplicate storage

### Allowed Types
- Images: JPEG, PNG, WebP, GIF
- Validate with `file.content_type` and file extension
- Reject executable files, scripts, archives

### Size Limits
- Configure max upload size in config
- Return 413 (Payload Too Large) if exceeded
- Check before processing to avoid memory issues

## API Security

### Rate Limiting
- Applied to auth endpoints (login, register)
- Applied to write endpoints (create, update, delete)
- Configured in `backend/app/core/rate_limit.py`
- Returns 429 (Too Many Requests) when exceeded

### CORS
- Configured per environment in `backend/app/core/config.py`
- Production: only allow `rootlink.ruisilvastudio.com`
- Development: allow `localhost:3000`
- Never allow `*` in production

### Error Handling
- Use appropriate HTTP status codes:
  - 400: Bad Request (invalid input)
  - 401: Unauthorized (no token or invalid token)
  - 403: Forbidden (valid token, insufficient permissions)
  - 404: Not Found
  - 409: Conflict (duplicate resource)
  - 413: Payload Too Large (file upload)
  - 422: Unprocessable Entity (validation error)
  - 429: Too Many Requests (rate limit)
  - 500: Internal Server Error

### Sensitive Data
- Never return password hashes in API responses
- Never return full credit card numbers
- Email addresses only visible to the user themselves
- API keys stored in environment variables, never in code

## Dependency Security

### Python Dependencies
- Use pinned versions in `pyproject.toml`
- Run `pip-audit` periodically to check for vulnerabilities
- Keep FastAPI, SQLAlchemy, and security packages updated

### Node Dependencies
- Use `npm audit` to check for vulnerabilities
- Keep Next.js and React updated
- Review dependency tree for unnecessary packages

## Session Management

### Token Storage
- Frontend: `localStorage` (accessible to JavaScript)
- Consider httpOnly cookies for higher security if needed
- Token cleared on logout

### Token Refresh
- Currently no refresh token mechanism
- User must re-login after token expiry
- Future: add refresh token rotation

## Admin Security

- Admin routes protected by `require_role(UserRole.admin)`
- Moderation routes protected by `require_role(UserRole.moderator)`
- Admin actions logged for audit trail
- Rate limiting on admin endpoints
- Admin panel only accessible to users with admin/moderator role
