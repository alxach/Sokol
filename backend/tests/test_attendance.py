import uuid

from tests.conftest import CENTER_ID, COACH_ID

DATE_TUE = "2026-09-01"  # вторник (day_of_week=2)
DATE_WED = "2026-09-02"  # среда (day_of_week=3)


async def _create_group(client, headers, sport="Дзюдо"):
    resp = await client.post(
        "/api/v1/groups",
        headers=headers,
        json={
            "name": f"Группа {uuid.uuid4().hex[:6]}",
            "sport_type": sport,
            "coach_id": COACH_ID,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _create_athlete(client, headers, first_name) -> str:
    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": first_name,
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


async def _add_member(client, headers, group_id, athlete_id):
    resp = await client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"athlete_id": athlete_id},
    )
    assert resp.status_code == 200, resp.text


async def _create_legacy_schedule(client, headers, group_id, day_of_week) -> str:
    resp = await client.post(
        "/api/v1/schedules",
        headers=headers,
        json={
            "group_id": group_id,
            "center_id": CENTER_ID,
            "coach_id": COACH_ID,
            "day_of_week": day_of_week,
            "start_time": "10:00:00",
            "end_time": "11:30:00",
            "location": "Зал А",
            "room": "101",
        },
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["id"])


async def test_attendance_journal_and_upsert(client, auth):
    headers = auth["superadmin"]
    group = await _create_group(client, headers, sport="Самбо")
    group_id = str(group["id"])
    athlete = await _create_athlete(client, headers, "Иван")
    await _add_member(client, headers, group_id, athlete)
    schedule_id = await _create_legacy_schedule(client, headers, group_id, 2)

    m1 = await client.post(
        "/api/v1/attendance/mark",
        headers=headers,
        json={
            "athlete_id": athlete,
            "schedule_id": schedule_id,
            "date": DATE_TUE,
            "status": "present",
        },
    )
    assert m1.status_code == 200, m1.text
    record_id = str(m1.json()["id"])

    listed = await client.get(f"/api/v1/attendance?date={DATE_TUE}", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    item = next(r for r in body["items"] if str(r["id"]) == record_id)
    assert item["athlete_name"] == "Тестов Иван"
    assert item["group_name"] == group["name"]
    assert item["discipline"] == "Самбо"
    assert item["coach_name"] == "Test coach"

    # повторный mark на тот же ключ -> update, а не дубль
    m2 = await client.post(
        "/api/v1/attendance/mark",
        headers=headers,
        json={
            "athlete_id": athlete,
            "schedule_id": schedule_id,
            "date": DATE_TUE,
            "status": "excused",
        },
    )
    assert m2.status_code == 200, m2.text
    assert str(m2.json()["id"]) == record_id

    loaded = await client.get(f"/api/v1/attendance?date={DATE_TUE}", headers=headers)
    same = [
        r
        for r in loaded.json()["items"]
        if r["athlete_id"] == athlete and r["schedule_id"] == schedule_id
    ]
    assert len(same) == 1
    assert same[0]["status"] == "excused"

    # журнал занятий дня, enriched
    jr = await client.get(f"/api/v1/attendance/journal?date={DATE_TUE}", headers=headers)
    assert jr.status_code == 200
    jitem = next(i for i in jr.json() if i["schedule_id"] == schedule_id)
    assert jitem["group_id"] == group_id
    assert jitem["group_name"] == group["name"]
    assert jitem["discipline"] == "Самбо"
    assert jitem["coach_name"] == "Test coach"
    ath_row = next(a for a in jitem["athletes"] if a["athlete_id"] == athlete)
    assert ath_row["status"] == "excused"
    assert ath_row["record_id"] == record_id

    # журнал по тренеру (coach_user_id)
    jf = await client.get(
        f"/api/v1/attendance/journal?date={DATE_TUE}&coach_user_id={group['coach_user_id']}",
        headers=headers,
    )
    assert jf.status_code == 200
    assert any(i["schedule_id"] == schedule_id for i in jf.json())


async def test_attendance_batch_and_delete(client, auth):
    headers = auth["superadmin"]
    group = await _create_group(client, headers, sport="Бокс")
    group_id = str(group["id"])
    a1 = await _create_athlete(client, headers, "Петр")
    a2 = await _create_athlete(client, headers, "Сидор")
    await _add_member(client, headers, group_id, a1)
    await _add_member(client, headers, group_id, a2)
    schedule_id = await _create_legacy_schedule(client, headers, group_id, 3)

    batch = await client.post(
        "/api/v1/attendance/batch",
        headers=headers,
        json={
            "group_id": group_id,
            "schedule_id": schedule_id,
            "date": DATE_WED,
            "records": [
                {
                    "athlete_id": a1,
                    "status": "present",
                },
                {
                    "athlete_id": a2,
                    "status": "absent",
                    "absence_reason": "болезнь",
                },
            ],
        },
    )
    assert batch.status_code == 200, batch.text
    records = batch.json()
    assert len(records) == 2
    row1 = next(r for r in records if r["athlete_id"] == a1)
    row2 = next(r for r in records if r["athlete_id"] == a2)
    assert row1["schedule_id"] == schedule_id
    assert row2["status"] == "absent"
    assert row2["absence_reason"] == "болезнь"

    # update одного статуса
    patched = await client.patch(
        f"/api/v1/attendance/{row1['id']}",
        headers=headers,
        json={"status": "absent"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["status"] == "absent"

    listed = await client.get(f"/api/v1/attendance?date={DATE_WED}", headers=headers)
    assert listed.status_code == 200
    items_by_id = {str(r["id"]): r for r in listed.json()["items"]}
    assert items_by_id[row1["id"]]["status"] == "absent"
    assert items_by_id[row2["id"]]["status"] == "absent"

    # удаление записи
    removed = await client.delete(
        f"/api/v1/attendance/{row1['id']}", headers=headers,
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["ok"] is True

    after = await client.get(f"/api/v1/attendance?date={DATE_WED}", headers=headers)
    ids_after = [r["id"] for r in after.json()["items"]]
    assert row1["id"] not in ids_after
    assert row2["id"] in ids_after

    # повторное удаление -> 404
    gone = await client.delete(
        f"/api/v1/attendance/{row1['id']}", headers=headers,
    )
    assert gone.status_code == 404


async def test_attendance_require_auth(client):
    resp = await client.get("/api/v1/attendance/journal?date=2026-09-01")
    assert resp.status_code == 401
    resp = await client.get("/api/v1/attendance")
    assert resp.status_code == 401
