# Permission Rules

> Role hierarchy, per-module access patterns, and ownership checks.

## Role Hierarchy

```
admin > moderator > contributor > user
```

| Role | Capabilities |
|------|-------------|
| **admin** | Full access: all CRUD, user management, content moderation, settings, broadcast, tax management |
| **moderator** | Content moderation: approve/reject content, review queue, comment moderation |
| **contributor** | Enhanced creation: can submit content for review, can create courses |
| **user** | Basic: CRUD on own entities, follow, RSVP, message, comment |

## Role Assignment

- Default role on registration: `user`
- Admin can change roles via admin panel
- Role stored in `User.role` field
- Checked via `require_role(role)` dependency factory

## Per-Module Access Rules

### Content
| Action | Who |
|--------|-----|
| Create | authenticated user (goes to review queue) |
| Read | anyone (published), author (draft) |
| Edit | author, admin |
| Delete | author, admin |
| Approve/reject | moderator, admin |
| Index for search | admin, system |

### Events
| Action | Who |
|--------|-----|
| Create | authenticated user |
| Read | anyone (public), authenticated (private based on visibility_roles) |
| Edit | creator, group admin (if group event), platform admin |
| Delete | creator, admin |
| RSVP | authenticated user |
| Cancel RSVP | RSVP owner, admin |
| Purchase ticket | authenticated user |
| Check-in | event creator, admin |

### Groups
| Action | Who |
|--------|-----|
| Create | authenticated user |
| Read | anyone |
| Edit | group admin, platform admin |
| Delete | admin only |
| Join | authenticated user |
| Leave | member |
| Manage members | group admin, platform admin |

### Marketplace
| Action | Who |
|--------|-----|
| Create listing | authenticated user |
| Read listing | anyone |
| Edit listing | seller, admin |
| Delete listing | seller, admin |
| Purchase | authenticated user (not own listing) |
| Claim (free) | authenticated user |
| Onboard seller | authenticated user |
| View orders/sales | own orders/sales only |

### Learning
| Action | Who |
|--------|-----|
| Create course | contributor, admin |
| Read course | anyone (published) |
| Edit course | author, admin |
| Delete course | admin |
| Enroll | authenticated user |
| Track progress | enrolled user |

### Plants
| Action | Who |
|--------|-----|
| Read | anyone |
| Search | anyone |
| Crawl UTAD | admin |
| Admin management | admin |

### Comments
| Action | Who |
|--------|-----|
| Create | authenticated user |
| Read | anyone (on public entities) |
| Delete | comment author, entity owner, admin |
| Moderate | moderator, admin |

### Messages
| Action | Who |
|--------|-----|
| Send | authenticated user |
| Read | conversation participants only |
| List conversations | own conversations only |

### Notifications
| Action | Who |
|--------|-----|
| Read | owner only |
| Mark read | owner only |
| Mark all read | owner only |
| SSE stream | owner only |

### Waste (Composting, Upcycling, Challenges)
| Action | Who |
|--------|-----|
| Create hub/project | authenticated user |
| Read | anyone |
| Edit | creator, admin |
| Join hub | authenticated user |
| Deposit | hub member |
| Create challenge | admin |

### Admin
| Action | Who |
|--------|-----|
| Dashboard | admin |
| User management | admin |
| Content moderation | moderator, admin |
| Settings | admin |
| Broadcast | admin |
| Taxonomy management | admin |

## Ownership Check Pattern

Every entity follows this pattern for ownership verification:

```python
# Backend pattern (in API handlers)
entity = await get_entity_or_404(entity_id)
if entity.created_by != current_user.id and current_user.role != UserRole.admin:
    raise HTTPException(status_code=403, detail="Not authorized")
```

**Common ownership fields:**
- `created_by` → Content, Event, Group, Course, LearningPath, CompostingHub, UpcyclingProject, WasteChallenge
- `user_id` → Bookmark, Comment, Notification, Follow, GroupMember, EventRSVP, ChecklistItem, Enrollment
- `seller_id` → Listing, ListingOrder
- `author_id` → ImageAsset (provenance)

## Visibility Rules

### User Visibility
- `visible_in_network = True` → appears in entity directory and user search
- `visible_in_network = False` → only visible via direct profile link

### Event Visibility
- `visibility = "public"` → visible to everyone
- `visibility = "private"` → visible only to users matching `visibility_roles` array
- `visibility_roles` → list of roles that can see private events

### Content Visibility
- `verification_status` controls publishing pipeline
- Unreviewed content visible only to author and admins
- Published content visible to everyone

## Frontend Permission Handling

- Backend always enforces permissions — frontend is display-only
- UI elements for unauthorized actions should be hidden or disabled
- Use `useAuth()` hook to get current user and check role
- Never rely solely on frontend checks for security
