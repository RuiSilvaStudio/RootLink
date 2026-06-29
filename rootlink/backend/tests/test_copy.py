"""Editable site copy (§12) — overrides + permissions."""


async def test_public_overrides_empty_by_default(client):
    r = await client.get("/api/copy?locale=en")
    assert r.status_code == 200
    assert r.json() == {}


async def test_non_editor_cannot_set(client, make_user):
    _, headers = await make_user(email="plain-copy@example.com", role="user")
    r = await client.put("/api/copy/create.button?locale=en", headers=headers, json={"value": "Make"})
    assert r.status_code == 403


async def test_can_edit_copy_user_can_set_and_public_reads_it(client, make_user):
    _, headers = await make_user(email="editor@example.com", can_edit_copy=True)
    r = await client.put("/api/copy/create.button?locale=en", headers=headers, json={"value": "Make"})
    assert r.status_code == 200
    pub = await client.get("/api/copy?locale=en")
    assert pub.json().get("create.button") == "Make"
    # other locale unaffected
    assert (await client.get("/api/copy?locale=pt")).json() == {}


async def test_super_admin_can_set_and_revert(client, make_user):
    _, headers = await make_user(email="su-copy@example.com", role="super_admin")
    await client.put("/api/copy/nav.search?locale=pt", headers=headers, json={"value": "Procurar!"})
    assert (await client.get("/api/copy?locale=pt")).json().get("nav.search") == "Procurar!"
    # revert
    d = await client.delete("/api/copy/nav.search?locale=pt", headers=headers)
    assert d.status_code == 200
    assert "nav.search" not in (await client.get("/api/copy?locale=pt")).json()


async def test_update_existing_override(client, make_user):
    _, headers = await make_user(email="editor2@example.com", can_edit_copy=True)
    await client.put("/api/copy/home.title?locale=en", headers=headers, json={"value": "v1"})
    await client.put("/api/copy/home.title?locale=en", headers=headers, json={"value": "v2"})
    assert (await client.get("/api/copy?locale=en")).json().get("home.title") == "v2"
