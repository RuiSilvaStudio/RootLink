"""Phase 5 — verification document upload + review (docs/roles-permissions/assessment.md §10a)."""

from app.models.entity import Entity


async def _pending_org(client, founder_headers, name="Doc Org"):
    r = await client.post("/api/entities/register", headers=founder_headers, json={
        "entity_type": "organization", "name": name,
    })
    return r.json()["id"]


_MIN_PDF = b"%PDF-1.4\n" + b"0" * 40  # not a real PDF, just enough bytes to pass size/type checks


async def test_registrant_can_upload_document(client, make_user):
    _founder, founder_headers = await make_user(email="docfounder@example.com", entity_kind="individual", rank=1)
    entity_id = await _pending_org(client, founder_headers)

    files = {"file": ("registration.pdf", _MIN_PDF, "application/pdf")}
    r = await client.post(f"/api/entities/{entity_id}/documents", headers=founder_headers, files=files)
    assert r.status_code == 201
    body = r.json()
    assert body["filename"] == "registration.pdf"
    assert body["entity_id"] == entity_id


async def test_stranger_cannot_upload_document(client, make_user):
    _founder, founder_headers = await make_user(email="docfounder2@example.com", entity_kind="individual", rank=1)
    entity_id = await _pending_org(client, founder_headers, name="Doc Org 2")

    _stranger, stranger_headers = await make_user(email="stranger@example.com", entity_kind="individual", rank=1)
    files = {"file": ("registration.pdf", _MIN_PDF, "application/pdf")}
    r = await client.post(f"/api/entities/{entity_id}/documents", headers=stranger_headers, files=files)
    assert r.status_code == 403


async def test_disallowed_content_type_rejected(client, make_user):
    _founder, founder_headers = await make_user(email="docfounder3@example.com", entity_kind="individual", rank=1)
    entity_id = await _pending_org(client, founder_headers, name="Doc Org 3")

    files = {"file": ("script.exe", b"MZ" + b"0" * 40, "application/x-msdownload")}
    r = await client.post(f"/api/entities/{entity_id}/documents", headers=founder_headers, files=files)
    assert r.status_code == 400


async def test_platform_admin_can_list_and_serve_documents(client, make_user):
    _founder, founder_headers = await make_user(email="docfounder4@example.com", entity_kind="individual", rank=1)
    entity_id = await _pending_org(client, founder_headers, name="Doc Org 4")

    files = {"file": ("registration.pdf", _MIN_PDF, "application/pdf")}
    r = await client.post(f"/api/entities/{entity_id}/documents", headers=founder_headers, files=files)
    doc_id = r.json()["id"]

    _admin, admin_headers = await make_user(email="docadmin@example.com", entity_kind="platform", rank=4)
    r = await client.get(f"/api/entities/{entity_id}/documents", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = await client.get(f"/api/entities/{entity_id}/documents/{doc_id}/serve", headers=admin_headers)
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
