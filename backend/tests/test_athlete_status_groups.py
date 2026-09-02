from tests.conftest import CENTER_ID, COACH_ID


async def _create_athlete(client, headers, status="active") -> str:
    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": "Пётр",
            "last_name": "Петров",
            "birth_date": "2010-05-01",
            "gender": "m",
            "sport_type": "Дзюдо",
            "center_id": CENTER_ID,
            "coach_id": COACH_ID,
            "status": status,
        },
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["id"])


async def _create_group(client, headers) -> str:
    resp = await client.post(
        "/api/v1/groups",
        headers=headers,
        json={"name": "Группа Тест", "sport_type": "Дзюдо", "coach_id": COACH_ID},
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["id"])


async def test_add_inactive_athlete_to_group_fails(client, auth):
    headers = auth["superadmin"]
    athlete_id = await _create_athlete(client, headers, status="inactive")
    group_id = await _create_group(client, headers)

    resp = await client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"athlete_id": athlete_id},
    )
    assert resp.status_code == 422


async def test_archiving_removes_from_group(client, auth):
    headers = auth["superadmin"]
    athlete_id = await _create_athlete(client, headers, status="active")
    group_id = await _create_group(client, headers)

    added = await client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"athlete_id": athlete_id},
    )
    assert added.status_code == 200, added.text

    updated = await client.patch(
        f"/api/v1/athletes/{athlete_id}",
        headers=headers,
        json={"status": "inactive"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "inactive"

    detail = await client.get(f"/api/v1/groups/{group_id}", headers=headers)
    assert detail.status_code == 200
    assert athlete_id not in detail.json()["athlete_ids"]


async def test_active_kept_in_group_when_status_changes_to_inactive_then_restore(client, auth):
    headers = auth["superadmin"]
    athlete_id = await _create_athlete(client, headers, status="active")
    group_id = await _create_group(client, headers)

    added = await client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"athlete_id": athlete_id},
    )
    assert added.status_code == 200, added.text

    archived = await client.patch(
        f"/api/v1/athletes/{athlete_id}",
        headers=headers,
        json={"status": "inactive"},
    )
    assert archived.status_code == 200

    detail = await client.get(f"/api/v1/groups/{group_id}", headers=headers)
    assert athlete_id not in detail.json()["athlete_ids"]

    restored = await client.patch(
        f"/api/v1/athletes/{athlete_id}",
        headers=headers,
        json={"status": "active"},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["status"] == "active"


async def test_active_remains_in_group_after_update(client, auth):
    headers = auth["superadmin"]
    athlete_id = await _create_athlete(client, headers, status="active")
    group_id = await _create_group(client, headers)

    added = await client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"athlete_id": athlete_id},
    )
    assert added.status_code == 200, added.text

    updated = await client.patch(
        f"/api/v1/athletes/{athlete_id}",
        headers=headers,
        json={"status": "active"},
    )
    assert updated.status_code == 200, updated.text

    detail = await client.get(f"/api/v1/groups/{group_id}", headers=headers)
    assert athlete_id in detail.json()["athlete_ids"]


async def test_invalid_status_rejected(client, auth):
    headers = auth["superadmin"]
    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": "Ба",
            "last_name": "Бад",
            "birth_date": "2010-05-01",
            "gender": "m",
            "sport_type": "Дзюдо",
            "status": "graduated",
        },
    )
    assert resp.status_code == 422
