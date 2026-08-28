import uuid

from tests.conftest import CENTER_ID, REGION_ID


async def test_region_update_by_superadmin(client, auth):
    resp = await client.patch(
        f"/api/v1/organizations/regions/{REGION_ID}",
        headers=auth["superadmin"],
        json={"name": "Регион обновлён"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Регион обновлён"
    assert resp.json()["id"] == REGION_ID


async def test_region_mutation_forbidden_for_director(client, auth):
    resp = await client.patch(
        f"/api/v1/organizations/regions/{REGION_ID}",
        headers=auth["director"],
        json={"name": "no"},
    )
    assert resp.status_code == 403, resp.text
    resp = await client.delete(
        f"/api/v1/organizations/regions/{REGION_ID}", headers=auth["director"],
    )
    assert resp.status_code == 403, resp.text


async def test_region_delete_blocked_when_has_centers(client, auth):
    resp = await client.delete(
        f"/api/v1/organizations/regions/{REGION_ID}", headers=auth["superadmin"],
    )
    assert resp.status_code == 409, resp.text


async def test_region_create_and_delete_empty(client, auth):
    resp = await client.post(
        "/api/v1/organizations/regions",
        headers=auth["superadmin"],
        json={"name": "Новый регион", "code": f"NR{uuid.uuid4().hex[:4].upper()}"},
    )
    assert resp.status_code == 200, resp.text
    region_id = resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/organizations/regions/{region_id}", headers=auth["superadmin"],
    )
    assert resp.status_code == 200, resp.text


async def test_center_update_and_list_by_region(client, auth):
    resp = await client.put(
        f"/api/v1/organizations/centers/{CENTER_ID}",
        headers=auth["superadmin"],
        json={"city": "Казань", "is_active": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["city"] == "Казань"
    assert resp.json()["is_active"] is False

    resp = await client.get(
        f"/api/v1/organizations/centers?region_id={REGION_ID}", headers=auth["superadmin"],
    )
    assert resp.status_code == 200, resp.text
    assert any(c["id"] == CENTER_ID for c in resp.json())


async def test_center_create_and_delete_empty(client, auth):
    region_id = REGION_ID
    resp = await client.post(
        "/api/v1/organizations/centers",
        headers=auth["director"],
        json={"name": "ЦСЕ Временный", "region_id": region_id, "address": "addr"},
    )
    assert resp.status_code == 200, resp.text
    center_id = resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/organizations/centers/{center_id}", headers=auth["superadmin"],
    )
    assert resp.status_code == 200, resp.text


async def test_center_delete_blocked_when_has_data(client, auth):
    resp = await client.delete(
        f"/api/v1/organizations/centers/{CENTER_ID}", headers=auth["superadmin"],
    )
    assert resp.status_code == 409, resp.text
