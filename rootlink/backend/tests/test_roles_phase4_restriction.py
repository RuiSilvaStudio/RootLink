"""Phase 4 — restriction rung (docs/roles-permissions/ROLES_PERMISSIONS.md §4, docs/roles-permissions/phase0-decisions.md (c)).

Restriction is the 4th `account_status` value: full read/write access
retained, but future content submissions are forced back to `in_review`
regardless of any trusted-publisher badge/rank.
"""

from app.models.content import Content, ContentSource, ContentStatus, ContentType
from app.models.user import AccountStatus, User


def _content(user_id: int, status=ContentStatus.draft) -> Content:
    return Content(
        title="T", content_type=ContentType.article, source=ContentSource.user,
        status=status, created_by=user_id,
    )


# ── Model-level ──

def test_is_restricted_property():
    user = User(email="x@example.com", name="x", password_hash="x", account_status=AccountStatus.restricted)
    assert user.is_restricted is True
    assert user.is_banned is False
    assert user.is_suspended is False


def test_restricted_user_retains_full_read_write_access():
    """Unlike suspend/ban, restriction must NOT affect can_author."""
    user = User(email="x@example.com", name="x", password_hash="x", account_status=AccountStatus.restricted)
    assert user.can_author is True


# ── Endpoint: restrict/lift-restriction (app/api/admin.py) ──

async def test_restrict_sets_account_status(client, make_user):
    admin, admin_headers = await make_user(email="admin@example.com", role="admin")
    target, _ = await make_user(email="target@example.com", role="user")

    r = await client.post(
        f"/api/admin/users/{target.id}/restrict", headers=admin_headers, json={"reason": "quality issues"},
    )
    assert r.status_code == 200
    assert r.json()["account_status"] == "restricted"


async def test_cannot_restrict_yourself(client, make_user):
    admin, admin_headers = await make_user(email="self@example.com", role="admin")
    r = await client.post(f"/api/admin/users/{admin.id}/restrict", headers=admin_headers, json={})
    assert r.status_code == 400


async def test_lift_restriction_requires_currently_restricted(client, make_user):
    admin, admin_headers = await make_user(email="admin2@example.com", role="admin")
    target, _ = await make_user(email="target2@example.com", role="user")
    r = await client.post(f"/api/admin/users/{target.id}/lift-restriction", headers=admin_headers)
    assert r.status_code == 400


async def test_lift_restriction_restores_active(client, make_user):
    admin, admin_headers = await make_user(email="admin3@example.com", role="admin")
    target, _ = await make_user(email="target3@example.com", role="user")
    await client.post(f"/api/admin/users/{target.id}/restrict", headers=admin_headers, json={})
    r = await client.post(f"/api/admin/users/{target.id}/lift-restriction", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["account_status"] == "active"


# ── Enforcement: article publish/edit trust bypass forced to in_review ──

async def test_restricted_trusted_publisher_still_goes_to_review_on_publish(client, make_user, session_factory):
    """A restricted user with can_self_publish=True must NOT publish
    instantly — docs/roles-permissions/ROLES_PERMISSIONS.md §4: "regardless of any trusted publisher
    badge.\""""
    user, headers = await make_user(
        email="trusted@example.com", role="user", can_self_publish=True,
        account_status="restricted",
    )
    r = await client.post("/api/articles/", headers=headers, json={
        "title": "My article", "summary": "x", "body": {"blocks": []},
    })
    assert r.status_code in (200, 201)
    article_id = r.json()["id"]

    r = await client.post(f"/api/articles/{article_id}/publish", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "in_review"


async def test_restricted_moderator_edit_of_published_article_forced_to_review(client, make_user, session_factory):
    """Even a moderator-ranked restricted user's edits to their OWN
    published article go back to review — account status overrides rank,
    not just the can_self_publish badge (docs/roles-permissions/ROLES_PERMISSIONS.md §4 closing line)."""
    user, headers = await make_user(
        email="mod@example.com", role="moderator", account_status="restricted",
    )
    async with session_factory() as s:
        c = Content(
            title="Live", content_type=ContentType.article, source=ContentSource.user,
            status=ContentStatus.published, created_by=user.id, slug="live-article",
        )
        s.add(c)
        await s.commit()
        cid = c.id

    r = await client.patch(f"/api/articles/{cid}", headers=headers, json={"title": "Live edited"})
    assert r.status_code == 200
    assert r.json()["status"] == "in_review"


async def test_non_restricted_trusted_publisher_still_publishes_instantly(client, make_user):
    """Control: without restriction, the existing trusted-publish behavior
    is untouched."""
    user, headers = await make_user(
        email="trusted2@example.com", role="user", can_self_publish=True,
    )
    r = await client.post("/api/articles/", headers=headers, json={
        "title": "My article 2", "summary": "x", "body": {"blocks": []},
    })
    article_id = r.json()["id"]
    r = await client.post(f"/api/articles/{article_id}/publish", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "published"
