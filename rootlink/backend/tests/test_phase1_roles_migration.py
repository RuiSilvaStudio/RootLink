"""Tests for the Phase 1 data migration (app/services/roles_migration.py).

Covers the mapping rules signed off in
docs/roles-permissions/phase0-decisions.md (b), including the
branches today's actual dev-DB seed data never exercises (organization
backfill, practitioner->partners heuristic) — these still need correctness
proof since real users will hit them eventually.
"""

from sqlalchemy import select

from app.core.security import hash_password
from app.models.entity import DelegationGrant, Entity
from app.models.user import User
from app.services.roles_migration import migrate_legacy_delegations, migrate_users_to_entity_rank


async def _get(session_factory, user_id):
    async with session_factory() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one()


async def _make_raw_user(session_factory, **kwargs):
    """Like the `make_user` fixture, but without forcing `name` from the
    email prefix — needed for the organization-grouping test, which relies
    on multiple users sharing the same `name` (today's only linkable proxy
    for "same org", per docs/roles-permissions/assessment.md §3.3).
    """
    kwargs.setdefault("password_hash", hash_password("secret123"))
    async with session_factory() as session:
        user = User(**kwargs)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def test_individual_contributor_maps_to_individual_rank2(session_factory, make_user):
    user, _ = await make_user(email="ind@example.com", role="contributor", account_type="individual")
    async with session_factory() as session:
        await migrate_users_to_entity_rank(session)
    migrated = await _get(session_factory, user.id)
    assert migrated.entity_kind == "individual"
    assert migrated.rank == 2
    assert migrated.entity_id is None


async def test_admin_individual_overrides_to_platform(session_factory, make_user):
    """The exact ambiguity docs/roles-permissions/assessment.md §3.3 flags: an `admin` role with
    `account_type=individual` has no valid ceiling under individual's own
    ceiling (contributor, rank 2) — must be re-homed to `platform`.
    """
    user, _ = await make_user(email="staffadmin@example.com", role="admin", account_type="individual")
    async with session_factory() as session:
        stats = await migrate_users_to_entity_rank(session)
    migrated = await _get(session_factory, user.id)
    assert migrated.entity_kind == "platform"
    assert migrated.rank == 4
    assert migrated.entity_id is None
    assert stats["platform_override_admin_super_admin"] >= 1


async def test_super_admin_individual_overrides_to_platform_rank5(session_factory, make_user):
    user, _ = await make_user(email="super@example.com", role="super_admin", account_type="individual")
    async with session_factory() as session:
        await migrate_users_to_entity_rank(session)
    migrated = await _get(session_factory, user.id)
    assert migrated.entity_kind == "platform"
    assert migrated.rank == 5


async def test_moderator_individual_ceiling_safety_net(session_factory, make_user):
    """Not explicitly named in docs/roles-permissions/phase0-decisions.md (b) (which only calls out
    admin/super_admin), but the same ceiling-conflict reasoning applies:
    individual's ceiling is contributor (rank 2), so a `moderator` (rank 3)
    role also has no valid home there and must be re-homed to `platform` —
    this is the generalized post-migration ceiling safety net (Pass 4).
    """
    user, _ = await make_user(email="mod@example.com", role="moderator", account_type="individual")
    async with session_factory() as session:
        stats = await migrate_users_to_entity_rank(session)
    migrated = await _get(session_factory, user.id)
    assert migrated.entity_kind == "platform"
    assert migrated.rank == 3
    assert stats["platform_override_ceiling_safety_net"] >= 1


async def test_practitioner_defaults_to_professional(session_factory, make_user):
    user, _ = await make_user(
        email="prac@example.com", role="contributor", account_type="practitioner",
    )
    async with session_factory() as session:
        stats = await migrate_users_to_entity_rank(session)
    migrated = await _get(session_factory, user.id)
    assert migrated.entity_kind == "professional"
    assert migrated.rank == 2
    assert migrated.entity_id is None
    assert stats["professional"] >= 1


async def test_practitioner_with_org_shaped_kind_and_vendor_keyword_redirects_to_partners(
    session_factory, make_user
):
    user, _ = await make_user(
        email="lawfirm@example.com",
        role="user",
        account_type="practitioner",
        organization_kind="company",
        services=["legal advice", "contract review"],
    )
    async with session_factory() as session:
        stats = await migrate_users_to_entity_rank(session)
    migrated = await _get(session_factory, user.id)
    assert migrated.entity_kind == "partners"
    assert migrated.rank == 1  # partners ceiling: persona only
    assert migrated.entity_id is not None
    assert stats["partners_from_practitioner_heuristic"] >= 1
    async with session_factory() as session:
        entity = (await session.execute(select(Entity).where(Entity.id == migrated.entity_id))).scalar_one()
        assert entity.entity_type == "partners"


async def test_organization_group_backfill_picks_highest_role_as_super_admin(
    session_factory, make_user
):
    # Three users sharing the same (service_area, name) — today's only
    # linkable proxy for "same org" (docs/roles-permissions/assessment.md §3.3).
    owner = await _make_raw_user(
        session_factory,
        email="owner@acme.example.com", role="moderator", account_type="organization",
        name="Acme Coop", service_area="Lisboa",
    )
    member1 = await _make_raw_user(
        session_factory,
        email="member1@acme.example.com", role="contributor", account_type="organization",
        name="Acme Coop", service_area="Lisboa",
    )
    member2 = await _make_raw_user(
        session_factory,
        email="member2@acme.example.com", role="user", account_type="organization",
        name="Acme Coop", service_area="Lisboa",
    )
    async with session_factory() as session:
        stats = await migrate_users_to_entity_rank(session)
    assert stats["organizations_created"] == 1
    assert stats["organization_members_migrated"] == 3

    m_owner = await _get(session_factory, owner.id)
    m_member1 = await _get(session_factory, member1.id)
    m_member2 = await _get(session_factory, member2.id)

    assert m_owner.entity_kind == "organization"
    assert m_owner.rank == 5  # highest existing role (moderator) -> bootstrapped super admin
    assert m_member1.rank == 1
    assert m_member2.rank == 1
    # All three share the same new entity row.
    assert m_owner.entity_id == m_member1.entity_id == m_member2.entity_id is not None


async def test_migration_is_idempotent(session_factory, make_user):
    user, _ = await make_user(email="idempotent@example.com", role="contributor", account_type="individual")
    async with session_factory() as session:
        stats1 = await migrate_users_to_entity_rank(session)
    async with session_factory() as session:
        stats2 = await migrate_users_to_entity_rank(session)
    assert stats1["migrated"] >= 1
    assert stats2["migrated"] == 0  # nothing left to migrate — entity_kind already set


async def test_legacy_delegation_backfill_creates_grants(session_factory, make_user):
    user, _ = await make_user(
        email="trusted@example.com", role="contributor", account_type="individual",
        can_self_publish=True, can_edit_copy=True,
    )
    async with session_factory() as session:
        stats = await migrate_legacy_delegations(session)
    assert stats["self_publish_grants_created"] == 1
    assert stats["edit_copy_grants_created"] == 1

    async with session_factory() as session:
        grants = (await session.execute(
            select(DelegationGrant).where(DelegationGrant.grantee_id == user.id)
        )).scalars().all()
    actions = {g.action for g in grants}
    assert actions == {"self_publish", "edit_copy"}
    # Existing boolean stays untouched/working in parallel (not cleared).
    refreshed = await _get(session_factory, user.id)
    assert refreshed.can_self_publish is True
    assert refreshed.can_edit_copy is True


async def test_legacy_delegation_backfill_idempotent(session_factory, make_user):
    user, _ = await make_user(
        email="trusted2@example.com", role="contributor", account_type="individual",
        can_self_publish=True,
    )
    async with session_factory() as session:
        await migrate_legacy_delegations(session)
    async with session_factory() as session:
        stats2 = await migrate_legacy_delegations(session)
    assert stats2["self_publish_grants_created"] == 0
