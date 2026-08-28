from tests.conftest import CENTER_ID, COACH_ID


async def _create_athlete(client, headers) -> str:
    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": "Иван",
            "last_name": "Тестов",
            "birth_date": "2010-05-01",
            "gender": "m",
            "sport_type": "Дзюдо",
            "center_id": CENTER_ID,
            "coach_id": COACH_ID,
        },
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["id"])


async def test_group_crud_flow(client, auth):
    headers = auth["superadmin"]

    created = await client.post(
        "/api/v1/groups",
        headers=headers,
        json={"name": "Группа А", "sport_type": "Дзюдо", "coach_id": COACH_ID},
    )
    assert created.status_code == 200, created.text
    group = created.json()
    group_id = str(group["id"])
    assert group["name"] == "Группа А"
    assert group["sport_type"] == "Дзюдо"
    assert group["coach_name"] == "Test coach"
    assert group["coach_user_id"] is not None
    assert group["athlete_ids"] == []
    assert group["athlete_count"] == 0

    resp = await client.get(
        "/api/v1/groups", headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list) and len(body) == 2
    data, total_count = body
    assert total_count >= 1
    listed = next(item for item in data if str(item["id"]) == group_id)
    assert listed["coach_name"] == "Test coach"

    athlete_id = await _create_athlete(client, headers)

    added = await client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"athlete_id": athlete_id},
    )
    assert added.status_code == 200, added.text
    assert added.json()["athlete_id"] == athlete_id

    duplicate = await client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"athlete_id": athlete_id},
    )
    assert duplicate.status_code == 409

    detail = await client.get(f"/api/v1/groups/{group_id}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["athlete_ids"] == [athlete_id]
    assert body["athlete_count"] == 1

    updated = await client.patch(
        f"/api/v1/groups/{group_id}",
        headers=headers,
        json={"name": "Группа B", "schedule_note": "вторник/пятница", "is_active": False},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Группа B"
    assert updated.json()["schedule_note"] == "вторник/пятница"
    assert updated.json()["is_active"] is False

    removed = await client.delete(
        f"/api/v1/groups/{group_id}/members/{athlete_id}",
        headers=headers,
    )
    assert removed.status_code == 200, removed.text

    gone = await client.delete(
        f"/api/v1/groups/{group_id}/members/{athlete_id}",
        headers=headers,
    )
    assert gone.status_code == 404

    deleted = await client.delete(f"/api/v1/groups/{group_id}", headers=headers)
    assert deleted.status_code == 200, deleted.text

    not_found = await client.get(f"/api/v1/groups/{group_id}", headers=headers)
    assert not_found.status_code == 404


async def test_groups_require_auth(client):
    resp = await client.get("/api/v1/groups")
    assert resp.status_code == 401


async def test_coach_can_manage_group(client, auth):
    created = await client.post(
        "/api/v1/groups",
        headers=auth["coach"],
        json={"name": "Тренерская", "sport_type": "СФП"},
    )
    assert created.status_code == 200, created.text
    group_id = str(created.json()["id"])

    resp = await client.patch(
        f"/api/v1/groups/{group_id}",
        headers=auth["coach"],
        json={"name": "Тренерская 2"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Тренерская 2"

    resp = await client.delete(f"/api/v1/groups/{group_id}", headers=auth["coach"])
    assert resp.status_code == 200
