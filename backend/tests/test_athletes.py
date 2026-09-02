from tests.conftest import CENTER_ID, COACH_ID


async def test_create_athlete_with_rank_and_patronymic(client, auth):
    headers = auth["superadmin"]
    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": "Степан",
            "last_name": "Стальнов",
            "middle_name": "Станиславович",
            "birth_date": "2010-04-18",
            "gender": "male",
            "sport_type": "Дзюдо",
            "center_id": CENTER_ID,
            "coach_id": COACH_ID,
            "rank": "КМС",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["middle_name"] == "Станиславович"
    assert body["rank"] == "КМС"
    athlete_id = str(body["id"])

    listed = await client.get("/api/v1/athletes", headers=headers)
    assert listed.status_code == 200
    items, total = listed.json()
    assert total >= 1
    row = next(a for a in items if str(a["id"]) == athlete_id)
    assert row["last_name"] == "Стальнов"
    assert row["rank"] == "КМС"


async def test_create_athlete_without_rank_is_null(client, auth):
    resp = await client.post(
        "/api/v1/athletes",
        headers=auth["coach"],
        json={
            "first_name": "Валерия",
            "last_name": "Верёвкина",
            "middle_name": "Викторовна",
            "birth_date": "2012-07-02",
            "gender": "female",
            "sport_type": "Дзюдо",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["rank"] is None


async def test_athletes_require_auth(client):
    resp = await client.get("/api/v1/athletes")
    assert resp.status_code == 401