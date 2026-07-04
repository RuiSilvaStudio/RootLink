"""The permissions registry — Phase 2, per Phase 0 decision (d)
(`docs/roles-permissions/phase0-decisions.md`).

A single, reviewable-in-a-PR, code artifact encoding
`docs/roles-permissions/ROLES_PERMISSIONS.md` §7 (entity-scoped actions)
and §8 (platform-wide actions) as `action -> {min_rank, entity_scope,
delegable, notes}` entries. This is the machine-checkable version of those
two tables — every enforcement check (backend, eventually) and every UI
gate (frontend, eventually) should be derived from or validated against
this one artifact, per `docs/roles-permissions/assessment.md` §4.1.

**Not wired into any existing endpoint's authorization logic yet** (Phase 3
scope). This module and the `can()` helper below are new, additive
infrastructure, proven correct by their own dedicated test suite
(`tests/test_permissions_registry.py`), not yet consumed by production code
paths.

## Simplifications, stated explicitly (not silently glossed over)

1. **Ownership tiers collapse into a single `min_rank`.** docs/roles-permissions/ROLES_PERMISSIONS.md §7
   distinguishes three tiers per action: ✅ (own item only), ☑️ (items owned
   by someone ranked below the actor, within the entity), and 🔑 (anyone's
   item, entity-wide — effectively only the entity's super admin). The
   phase0(d)-signed-off registry shape (`min_rank`/`entity_scope`/
   `delegable`/`notes`) has no field for this distinction. `min_rank` here
   always encodes the *lowest* rank at which the action becomes possible at
   all (the ✅ threshold); the finer ✅/☑️/🔑 ownership-comparison logic is
   deliberately left for Phase 3's `can()` call sites to layer on top (they
   already have the target object's owner id and the entity's membership
   list; the registry doesn't need to know about individual content rows).
   Where an action's ☑️/🔑 tiers sit at a *higher* rank than its ✅ tier,
   that's recorded in `notes` for whoever builds the Phase 3 ownership
   check.
2. **"Manage any X" (the 🔑 entity-wide tier) is modeled as its own,
   separate action key** from "create/edit own X" wherever docs/roles-permissions/ROLES_PERMISSIONS.md
   §10 lists a delegable entity-wide capability for that domain (e.g.
   `article.manage_any` vs. `article.create_edit_archive_own`). This is
   because §10's delegation tables delegate specifically the entity-wide
   tier, not the "own item" tier — conflating them would make `delegable`
   wrong for one or the other.
3. **Delegation reaching *below* an action's base `min_rank`** (e.g. §10
   shows "Manage (review/approve/reject) any article" delegable down to
   Contributor, even though §7's own Approve-article row requires Moderator
   at minimum) is recorded as a `notes` string, not a second numeric field —
   the phase0(d) shape doesn't have a "delegated minimum rank" column. A
   real delegation grant (`delegation_grants` table) is what actually lets
   a specific below-minimum user perform the action; `can()` does not model
   grant lookups yet either (see its own docstring).
"""

import enum
from dataclasses import dataclass


class Rank(enum.IntEnum):
    """docs/roles-permissions/ROLES_PERMISSIONS.md §5."""

    visitor = 0
    persona = 1
    contributor = 2
    moderator = 3
    admin = 4
    super_admin = 5


EntityScope = str  # "platform" | "entity" — kept as the phase0(d)-signed-off str union


@dataclass(frozen=True)
class PermissionEntry:
    min_rank: int
    entity_scope: str  # "platform" | "entity"
    delegable: bool
    notes: str = ""


# ---------------------------------------------------------------------------
# docs/roles-permissions/ROLES_PERMISSIONS.md §7 — entity-scoped actions
# ---------------------------------------------------------------------------
_ENTITY_SCOPED: dict[str, PermissionEntry] = {
    "link.submit": PermissionEntry(Rank.persona, "entity", False),
    "article.crawl": PermissionEntry(Rank.contributor, "entity", False),
    "article.create_edit_archive_own": PermissionEntry(
        Rank.persona, "entity", False,
        notes="✅ persona+ own item; ☑️ moderator/admin (below-rank items); 🔑 super admin (entity-wide).",
    ),
    "article.review": PermissionEntry(
        Rank.contributor, "entity", True,
        notes="§7: ☑️ contributor/moderator/admin, 🔑 super admin. Delegable per §10 down to contributor.",
    ),
    "article.approve": PermissionEntry(
        Rank.moderator, "entity", True,
        notes="§7: ☑️ moderator/admin, 🔑 super admin. §10 lists this delegable down to contributor "
              "even though the base min_rank here is moderator — see module docstring point 3.",
    ),
    "article.revert_approval": PermissionEntry(
        Rank.moderator, "entity", True,
        notes="Same self-approval restriction as article.approve (docs/roles-permissions/ROLES_PERMISSIONS.md §6 separation of duties). "
              "Delegable per §10, same note as article.approve.",
    ),
    "feed.add_archive_own": PermissionEntry(Rank.persona, "entity", False),
    "plants.create_edit": PermissionEntry(
        Rank.moderator, "entity", False, notes="🔑 tier at super admin (entity-wide) per §7.",
    ),
    "plants.import": PermissionEntry(
        Rank.admin, "entity", False, notes="Admin+ — importing pulls in unreviewed external data.",
    ),
    "group.create_edit": PermissionEntry(
        Rank.contributor, "entity", False,
        notes="✅☑️ at admin, ✅🔑 at super admin — see group.manage_any for the delegable entity-wide tier.",
    ),
    "group.manage_any": PermissionEntry(
        Rank.moderator, "entity", True,
        notes="The 🔑 entity-wide tier of 'create/edit group' — delegable per §10 to moderator+.",
    ),
    "product.create_edit_archive": PermissionEntry(
        Rank.persona, "entity", False,
        notes="✅ persona+ own; ☑️ moderator/admin; 🔑 super admin — see product.manage_any for delegable tier.",
    ),
    "product.manage_any": PermissionEntry(
        Rank.moderator, "entity", True,
        notes="The 🔑 entity-wide tier of product create/edit/archive — delegable per §10 to moderator+.",
    ),
    "compost_listing.create_edit_own": PermissionEntry(
        Rank.contributor, "entity", False,
        notes="No ☑️ tier at all — only the entity super admin (🔑) can edit someone else's, per §7's own note.",
    ),
    "comment.add_edit_remove_own": PermissionEntry(
        Rank.persona, "entity", False,
        notes="☑️ moderator/admin can also cancel (remove) someone else's within their rank tier; 🔑 super admin entity-wide.",
    ),
    "event.create_edit_cancel_own": PermissionEntry(
        Rank.contributor, "entity", False,
        notes="No ☑️ tier at moderator/admin (deliberately stricter than articles/products/groups, §7's own note) — see event.manage_any.",
    ),
    "event.manage_any": PermissionEntry(
        Rank.moderator, "entity", True,
        notes="The 🔑 entity-wide tier of event create/edit/cancel — delegable per §10 to moderator+.",
    ),
    "event_sponsor.add_edit_cancel_own": PermissionEntry(Rank.contributor, "entity", False),
    "event_vendor.add_edit_cancel_own": PermissionEntry(
        Rank.contributor, "entity", False,
        notes="Renamed from 'supplier' in docs/roles-permissions/ROLES_PERMISSIONS.md to avoid confusion with the `suppliers` platform entity.",
    ),
    "notification.send_to_entity_members": PermissionEntry(Rank.admin, "entity", False),
    "donation.donate": PermissionEntry(Rank.visitor, "entity", False, notes="Available even to visitors."),
    "like.add_revert": PermissionEntry(Rank.persona, "entity", False),
    "message.send_direct": PermissionEntry(Rank.persona, "entity", False),
    "course.create_edit_archive_own": PermissionEntry(
        Rank.contributor, "entity", False, notes="🔑 tier at super admin — see course.manage_any.",
    ),
    "course.manage_any": PermissionEntry(
        Rank.moderator, "entity", True,
        notes="The 🔑 entity-wide tier of course create/edit/archive — delegable per §10 to moderator+.",
    ),
    "upcycle_project.share_edit_archive": PermissionEntry(
        Rank.persona, "entity", False, notes="🔑 tier at super admin (entity-wide) per §7.",
    ),
    "user.follow_unfollow": PermissionEntry(Rank.persona, "entity", False),
    "organization.follow_unfollow": PermissionEntry(Rank.persona, "entity", False),
    "professional.follow_unfollow": PermissionEntry(Rank.persona, "entity", False),
    "user.restrict_suspend_ban_lift": PermissionEntry(
        Rank.super_admin, "entity", False,
        notes="Entity-scoped version (§7). NOT delegable — docs/roles-permissions/ROLES_PERMISSIONS.md §10 explicitly excludes this.",
    ),
    "group.join_rsvp": PermissionEntry(Rank.persona, "entity", False),
    "content.browse_read_public": PermissionEntry(Rank.visitor, "entity", False),
    "password.reset_own": PermissionEntry(Rank.persona, "entity", False),
    "password.reset_entity_member": PermissionEntry(
        Rank.super_admin, "entity", True,
        notes="Base authority is the entity super admin; §10 shows this delegable down to moderator+.",
    ),
    "session.revoke_own": PermissionEntry(Rank.persona, "entity", False),
    "session.revoke_other": PermissionEntry(
        Rank.admin, "entity", False,
        notes="☑️ admin (below-rank users), 🔑 super admin (entity-wide) per §7. Not in §10's delegable list.",
    ),
    "trusted_publisher.grant_revoke_entity": PermissionEntry(
        Rank.admin, "entity", False,
        notes="☑️ admin, 🔑 super admin per §7. Not in §10's delegable list (only the platform-wide "
              "version in §8 is the documented fallback/override for entities with no local admin tier).",
    ),
    "partner_team.manage_roster": PermissionEntry(
        Rank.super_admin, "entity", False,
        notes="partners/suppliers only. In practice exercised via the entity's `primary_contact_user_id` "
              "designation (docs/roles-permissions/ROLES_PERMISSIONS.md §3), not by rank at all — those entity types have no "
              "moderator/admin/super-admin tier to hold rank 5 in the first place. Modeled at rank 5 here "
              "as the nominal base authority since the registry shape has no 'designation, not rank' axis.",
    ),
    "user.demote": PermissionEntry(
        Rank.admin, "entity", False,
        notes="☑️ admin, ☑️🔑 super admin per §7. NOT delegable — docs/roles-permissions/ROLES_PERMISSIONS.md §10 explicitly excludes this "
              "(ties into §6's approval-chain rules).",
    ),
    "user.promote": PermissionEntry(
        Rank.moderator, "entity", False,
        notes="☑️ moderator/admin, ☑️🔑 super admin per §7. NOT delegable — same §10 exclusion as demote.",
    ),
    # Phase 4 additions — docs/roles-permissions/ROLES_PERMISSIONS.md §3's entity conversion/dissolution.
    # Not in the original §7/§8 tables (which predate this phase's build),
    # added here following the same registry shape rather than as scattered
    # ad-hoc rank checks in the endpoint. See docs/roles-permissions/phase0-decisions.md addendum.
    "entity.convert_individual_to_professional": PermissionEntry(
        Rank.persona, "entity", False,
        notes="Any verified persona+ individual may request this (subject to 'Verified professional' "
              "criteria, §2) — not rank-gated beyond persona, since it's a self-service category switch.",
    ),
    "entity.convert_professional_to_organization": PermissionEntry(
        Rank.persona, "entity", False,
        notes="Any professional-entity persona+ may request this — becomes the new organization's "
              "bootstrap super admin (§3 'Bootstrapping a new entity'), no approval step.",
    ),
    # Post-Phase-6 product decision (docs/roles-permissions/phase0-decisions.md Addendum 5): the
    # missing reverse direction. Rank is preserved-or-capped to individual's
    # ceiling (contributor(2)), NOT reset to persona(1) — see
    # app.services.entity_conversion for the shared cap-rule implementation.
    "entity.convert_professional_to_individual": PermissionEntry(
        Rank.persona, "entity", False,
        notes="Any professional-entity persona+ may self-service convert back to individual — rank "
              "preserved if already ≤2, else capped down to 2 (not reset to 1). Same self-service-"
              "only, immediate, one-way shape as the other conversion directions.",
    ),
    "entity.request_dissolution": PermissionEntry(
        Rank.super_admin, "entity", False,
        notes="The entity's own super admin may TRIGGER/REQUEST dissolution (organization/partners/"
              "suppliers only) — but see entity.dissolve (platform-wide) for the actual approval/"
              "execution step, which this action alone can never perform.",
    ),
}

# ---------------------------------------------------------------------------
# docs/roles-permissions/ROLES_PERMISSIONS.md §8 — platform-wide actions (platform entity only)
# ---------------------------------------------------------------------------
_PLATFORM_WIDE: dict[str, PermissionEntry] = {
    "learning_path.create_edit_archive": PermissionEntry(Rank.moderator, "platform", False),
    "platform_family.add": PermissionEntry(Rank.super_admin, "platform", False),
    "platform_family.edit": PermissionEntry(Rank.admin, "platform", False),
    "platform_family.archive": PermissionEntry(Rank.super_admin, "platform", False),
    "legal.edit_update_content": PermissionEntry(
        Rank.super_admin, "platform", True,
        notes="§10 platform table shows this delegable down to admin(4).",
    ),
    "legal.edit_documents": PermissionEntry(
        Rank.super_admin, "platform", False,
        notes="Terms/Privacy specifically — distinct row from legal.edit_update_content; not in §10's delegable list.",
    ),
    "compost_listing.archive": PermissionEntry(Rank.super_admin, "platform", False),
    "group.archive": PermissionEntry(
        Rank.super_admin, "platform", False,
        notes="Platform-only because a group can have members from multiple entities (§8's own framing).",
    ),
    "event.archive": PermissionEntry(
        Rank.super_admin, "platform", False,
        notes="Platform-only because an event can have attendees from multiple entities (§8's own framing).",
    ),
    "entity.dissolve": PermissionEntry(
        Rank.super_admin, "platform", False,
        notes="organization/partners/suppliers dissolution. Requires platform super admin approval "
              "regardless of who triggered it (docs/roles-permissions/ROLES_PERMISSIONS.md §3) — not delegable, ever.",
    ),
    "article.remove_crawled": PermissionEntry(Rank.admin, "platform", False),
    "link.remove_submitted": PermissionEntry(Rank.admin, "platform", False),
    "plants.archive": PermissionEntry(Rank.super_admin, "platform", False),
    "platform_ui.edit_content": PermissionEntry(
        Rank.super_admin, "platform", True,
        notes="§10 platform table shows this delegable all the way down to persona(1) — the broadest "
              "delegation reach of any action in either table.",
    ),
    "user.grant_revoke_roles": PermissionEntry(
        Rank.super_admin, "platform", False,
        notes="Platform-wide promote/demote/role-grant. NOT delegable — docs/roles-permissions/ROLES_PERMISSIONS.md §6 separation-of-duties.",
    ),
    "password.reset_other_platform_wide": PermissionEntry(Rank.admin, "platform", False),
    "user.restrict_suspend_ban_lift_platform_wide": PermissionEntry(
        Rank.super_admin, "platform", True,
        notes="§10 platform table shows this delegable down to admin(4).",
    ),
    "trusted_publisher.grant_revoke_platform_default": PermissionEntry(
        Rank.admin, "platform", False,
        notes="The platform-wide fallback/override for entities with no local admin tier "
              "(individual/partners/suppliers) — see entity-scoped trusted_publisher.grant_revoke_entity.",
    ),
    "entity.verify_organization_practitioner": PermissionEntry(Rank.admin, "platform", False),
    "platform.manage_settings_taxonomy": PermissionEntry(Rank.super_admin, "platform", False),
    "broadcast.send": PermissionEntry(Rank.admin, "platform", False),
    # Phase 4 additions.
    "entity.reverse_dissolution": PermissionEntry(
        Rank.super_admin, "platform", False,
        notes="Reversal within the 30-day grace period (docs/roles-permissions/ROLES_PERMISSIONS.md §3) — platform super admin only, "
              "same as the dissolution approval itself.",
    ),
    "entity.ban": PermissionEntry(
        Rank.super_admin, "platform", False,
        notes="Entity-level ban (Phase 4 addendum — not in the original §8 table, see "
              "docs/roles-permissions/phase0-decisions.md addendum). Triggers the cross-entity footprint cascade (§3).",
    ),
    "entity.unban": PermissionEntry(Rank.super_admin, "platform", False),
}

REGISTRY: dict[str, PermissionEntry] = {**_ENTITY_SCOPED, **_PLATFORM_WIDE}


def get(action: str) -> PermissionEntry | None:
    return REGISTRY.get(action)


def entity_scoped_actions() -> dict[str, PermissionEntry]:
    return dict(_ENTITY_SCOPED)


def platform_wide_actions() -> dict[str, PermissionEntry]:
    return dict(_PLATFORM_WIDE)
