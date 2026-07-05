"""`product.manage_any` enforcement floor (docs/roles-permissions/ROLES_PERMISSIONS.md
§7/§10: moderator+ may edit/delete another user's marketplace listing).
The endpoint historically required admin(4) — a stricter-than-registry
mismatch surfaced while wiring the /marketplace/[id] UI gate to the
registry (UI backlog batch 2, 2026-07-04); floor aligned to moderator.
"""

from app.models.marketplace import Listing


async def _make_listing(session_factory, seller_id):
    async with session_factory() as session:
        listing = Listing(seller_id=seller_id, title="Hand tools", price_cents=1000)
        session.add(listing)
        await session.commit()
        await session.refresh(listing)
        return listing.id


async def test_moderator_can_edit_another_users_listing(client, make_user, session_factory):
    seller, _ = await make_user(email="seller-m@example.com", role="user")
    _, mod_headers = await make_user(email="mod-m@example.com", role="moderator")
    listing_id = await _make_listing(session_factory, seller.id)

    resp = await client.put(
        f"/api/marketplace/listings/{listing_id}",
        headers=mod_headers,
        json={"title": "Hand tools (moderated)"},
    )
    assert resp.status_code == 200, resp.text


async def test_moderator_can_delete_another_users_listing(client, make_user, session_factory):
    seller, _ = await make_user(email="seller-m2@example.com", role="user")
    _, mod_headers = await make_user(email="mod-m2@example.com", role="moderator")
    listing_id = await _make_listing(session_factory, seller.id)

    resp = await client.delete(f"/api/marketplace/listings/{listing_id}", headers=mod_headers)
    assert resp.status_code == 204


async def test_contributor_cannot_edit_another_users_listing(client, make_user, session_factory):
    seller, _ = await make_user(email="seller-m3@example.com", role="user")
    _, contrib_headers = await make_user(email="contrib-m@example.com", role="contributor")
    listing_id = await _make_listing(session_factory, seller.id)

    resp = await client.put(
        f"/api/marketplace/listings/{listing_id}",
        headers=contrib_headers,
        json={"title": "Should fail"},
    )
    assert resp.status_code == 403


async def test_owner_can_still_edit_own_listing(client, make_user, session_factory):
    seller, seller_headers = await make_user(email="seller-m4@example.com", role="user")
    listing_id = await _make_listing(session_factory, seller.id)

    resp = await client.put(
        f"/api/marketplace/listings/{listing_id}",
        headers=seller_headers,
        json={"title": "My updated tools"},
    )
    assert resp.status_code == 200, resp.text
