"""Live fallback for resolving a user's (entity_kind, rank) when the stored
`User.entity_kind`/`rank` columns are still `None`.

`app.services.roles_migration` populates these columns for every row that
existed at the time its one-time, startup-lifespan batch job ran (Phase 1).
**Any user created afterward — i.e. every real registration from now on —
never goes through that batch job**, since Phase 1 was explicitly scoped to
backfilling existing rows, not to changing what `/api/auth/register` writes.
Without a fallback, `can()` (Phase 3's endpoint cutover) would silently
treat every new signup as a rank-less, entity-less "visitor" forever, since
nothing else ever sets `entity_kind`/`rank` for them.

`resolve_entity_and_rank` closes that gap: it returns the stored values if
already migrated, otherwise computes the same simple, per-user mapping
`app.services.roles_migration` uses for individual/professional/platform
users (`docs/roles-permissions/phase0-decisions.md` (b)) — deliberately **not** the `organization`
cross-user group-backfill, which needs a whole-table view of "who else
shares this org" and only makes sense as the batch job. A brand-new
`account_type="organization"` user who hasn't been through that batch
backfill yet resolves conservatively (`entity_kind="organization"`, rank 1,
implicitly `entity_id=None`) rather than inventing an `entities` row here.

Deliberately duplicates (rather than imports) `roles_migration.py`'s small,
stable rank/ceiling maps: `roles_migration.py` is already tested,
already-verified Phase 1 code, and refactoring it to share this module was
judged higher-risk than a few duplicated constant lines for this cutover.
"""

ROLE_RANK: dict[str, int] = {
    "user": 1,
    "contributor": 2,
    "moderator": 3,
    "admin": 4,
    "super_admin": 5,
}

ENTITY_CEILING: dict[str, int] = {
    "individual": 2,
    "professional": 4,
    "organization": 5,
    "platform": 5,
    "partners": 1,
    "suppliers": 1,
}


def resolve_entity_and_rank(user) -> tuple[str, int]:
    """Returns (entity_kind, rank) — from the stored columns if already
    migrated, else computed live via the same simple rules Phase 1's batch
    migration applies per-user (admin/super_admin -> platform override;
    ceiling safety net).

    Uses `entity_kind IS NULL` as the "not yet migrated" sentinel — the same
    one `roles_migration.py`'s own idempotency guard uses — not "either
    column is null": a row with `entity_kind` set but `rank` somehow still
    `None` is treated as rank 0 (visitor-level), not re-computed from scratch,
    since a real migrated row always sets both together.
    """
    if user.entity_kind is not None:
        return user.entity_kind, (user.rank if user.rank is not None else 0)

    role = str(getattr(user, "role", None) or "user")
    account_type = getattr(user, "account_type", None) or "individual"

    if role in ("admin", "super_admin"):
        return "platform", ROLE_RANK[role]

    if account_type == "practitioner":
        entity_kind = "professional"
    elif account_type == "organization":
        entity_kind = "organization"
    else:
        entity_kind = "individual"

    rank = ROLE_RANK.get(role, 1)
    ceiling = ENTITY_CEILING.get(entity_kind, 1)
    if rank > ceiling:
        return "platform", rank
    return entity_kind, rank
