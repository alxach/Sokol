from tests.conftest import CENTER_ID, COACH_ID, COACH2_ID


async def _make_athlete(client, headers, status="active", coach_id=COACH_ID) -> str:
    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": "Иван",
            "last_name": "Иванов",
            "birth_date": "2011-04-12",
            "gender": "m",
            "sport_type": "Самбо",
            "center_id": CENTER_ID,
            "coach_id": coach_id,
            "status": status,
        },
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["id"])


async def test_transfer_active_athlete_forbidden(client, auth):
    headers = auth["superadmin"]
    athlete_id = await _make_athlete(client, headers, status="active")

    resp = await client.post(
        f"/api/v1/athletes/{athlete_id}/transfer",
        headers=headers,
        json={"new_coach_id": COACH2_ID},
    )
    assert resp.status_code == 422
    assert "архив" in resp.json()["detail"].lower()


async def test_transfer_archived_athlete_updates_coach(client, auth):
    headers = auth["superadmin"]
    athlete_id = await _make_athlete(client, headers, status="active")

    archived = await client.patch(
        f"/api/v1/athletes/{athlete_id}",
        headers=headers,
        json={"status": "inactive"},
    )
    assert archived.status_code == 200, archived.text

    resp = await client.post(
        f"/api/v1/athletes/{athlete_id}/transfer",
        headers=headers,
        json={"new_coach_id": COACH2_ID},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["coach_id"] == COACH2_ID


async def test_transfer_missing_athlete_404(client, auth):
    headers = auth["superadmin"]
    resp = await client.post(
        "/api/v1/athletes/00000000-0000-0000-0000-000000000000/transfer",
        headers=headers,
        json={"new_coach_id": COACH2_ID},
    )
    assert resp.status_code == 404


async def test_transfer_to_missing_coach_422(client, auth):
    headers = auth["superadmin"]
    athlete_id = await _make_athlete(client, headers, status="inactive")

    resp = await client.post(
        f"/api/v1/athletes/{athlete_id}/transfer",
        headers=headers,
        json={"new_coach_id": "99999999-9999-9999-9999-999999999999"},
    )
    assert resp.status_code == 422


async def test_transfer_requires_admin_or_director(client, auth):
    headers = auth["coach"]
    athlete_id = await _make_athlete(client, auth["superadmin"], status="inactive")

    resp = await client.post(
        f"/api/v1/athletes/{athlete_id}/transfer",
        headers=headers,
        json={"new_coach_id": COACH2_ID},
    )
    assert resp.status_code == 403
