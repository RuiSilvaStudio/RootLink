"""Content UI Editor — image/icon overrides + strict super_admin permission."""


async def test_public_overrides_empty_by_default(client):
    r = await client.get("/api/content-ui")
    assert r.status_code == 200
    assert r.json() == {}


async def test_plain_user_cannot_set(client, make_user):
    _, headers = await make_user(email="plain-cui@example.com", role="user")
    r = await client.put(
        "/api/content-ui/home.hero.icon",
        headers=headers,
        json={"kind": "icon", "value": {"iconId": "leaf"}},
    )
    assert r.status_code == 403


async def test_can_edit_copy_user_cannot_set(client, make_user):
    """Unlike /api/copy, this feature does NOT honor the can_edit_copy delegation."""
    _, headers = await make_user(email="delegate-cui@example.com", can_edit_copy=True)
    r = await client.put(
        "/api/content-ui/home.hero.icon",
        headers=headers,
        json={"kind": "icon", "value": {"iconId": "leaf"}},
    )
    assert r.status_code == 403


async def test_super_admin_can_set_and_public_reads_it(client, make_user):
    _, headers = await make_user(email="su-cui@example.com", role="super_admin")
    r = await client.put(
        "/api/content-ui/home.category.plants.icon",
        headers=headers,
        json={"kind": "icon", "value": {"iconId": "sprout"}},
    )
    assert r.status_code == 200
    pub = (await client.get("/api/content-ui")).json()
    assert pub["home.category.plants.icon"] == {"kind": "icon", "value": {"iconId": "sprout"}}


async def test_super_admin_can_set_image_and_revert(client, make_user):
    _, headers = await make_user(email="su-cui-img@example.com", role="super_admin")
    await client.put(
        "/api/content-ui/home.hero.image",
        headers=headers,
        json={"kind": "image", "value": {"assetId": 1, "url": "https://x/img.webp", "alt": "Garden"}},
    )
    assert (await client.get("/api/content-ui")).json().get("home.hero.image") is not None
    d = await client.delete("/api/content-ui/home.hero.image", headers=headers)
    assert d.status_code == 200
    assert "home.hero.image" not in (await client.get("/api/content-ui")).json()


async def test_update_existing_override(client, make_user):
    _, headers = await make_user(email="su-cui-upd@example.com", role="super_admin")
    await client.put(
        "/api/content-ui/home.category.tools.icon",
        headers=headers,
        json={"kind": "icon", "value": {"iconId": "wrench"}},
    )
    await client.put(
        "/api/content-ui/home.category.tools.icon",
        headers=headers,
        json={"kind": "icon", "value": {"iconId": "hammer"}},
    )
    pub = (await client.get("/api/content-ui")).json()
    assert pub["home.category.tools.icon"]["value"]["iconId"] == "hammer"
