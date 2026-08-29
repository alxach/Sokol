from tests.conftest import CENTER_ID, COACH_ID

GROUP_NAME = "Группа расписания"


async def _create_group(client, headers) -> str:
    resp = await client.post(
        "/api/v1/groups",
        headers=headers,
        json={
            "name": GROUP_NAME,
            "sport_type": "Хоккей",
            "coach_id": COACH_ID,
            "center_id": CENTER_ID,
        },
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["id"])


async def _create_period(client, headers, group_id, start="2026-09-01", end="2026-12-31"):
    resp = await client.post(
        "/api/v1/schedules/periods",
        headers=headers,
        json={"group_id": group_id, "period_start": start, "period_end": end},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_schedule_periods_lifecycle(client, auth):
    headers = auth["superadmin"]
    group_id = await _create_group(client, headers)

    # create period with enrich
    p1 = await _create_period(client, headers, group_id)
    p1_id = str(p1["id"])
    assert p1["status"] == "draft"
    assert p1["group_name"] == GROUP_NAME
    assert p1["discipline"] == "Хоккей"
    assert p1["coach_name"] == "Test coach"
    assert p1["coach_user_id"] is not None
    assert p1["center_id"] == CENTER_ID
    assert p1["lesson_count"] == 0
    assert p1["absences"] == []

    # create lesson item
    item = await client.post(
        f"/api/v1/schedules/periods/{p1_id}/items",
        headers=headers,
        json={"day_of_week": 2, "start_time": "18:00", "end_time": "20:00", "room": "Зал 1"},
    )
    assert item.status_code == 200, item.text
    assert item.json()["day_of_week"] == 2
    assert item.json()["start_time"] == "18:00"

    # list filtered by coach_user_id
    resp = await client.get(
        f"/api/v1/schedules/periods?coach_user_id={p1['coach_user_id']}", headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    listed = next(p for p in body["items"] if str(p["id"]) == p1_id)
    assert listed["lesson_count"] == 1

    # detail with items
    detail = await client.get(f"/api/v1/schedules/periods/{p1_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert len(detail.json()["items"]) == 1
    assert detail.json()["lesson_count"] == 1

    # approve p1 -> active
    ap = await client.post(f"/api/v1/schedules/periods/{p1_id}/approve", headers=headers)
    assert ap.status_code == 200, ap.text
    assert ap.json()["status"] == "active"

    # second period of same group: approve archives p1
    p2 = await _create_period(client, headers, group_id)
    p2_id = str(p2["id"])
    ap2 = await client.post(f"/api/v1/schedules/periods/{p2_id}/approve", headers=headers)
    assert ap2.status_code == 200, ap2.text
    assert ap2.json()["status"] == "active"
    p1_after = await client.get(f"/api/v1/schedules/periods/{p1_id}", headers=headers)
    assert p1_after.status_code == 200
    assert p1_after.json()["status"] == "archived"

    # status filters
    act = await client.get("/api/v1/schedules/periods?status=active", headers=headers)
    assert act.status_code == 200
    assert all(p["status"] == "active" for p in act.json()["items"])
    arch = await client.get("/api/v1/schedules/periods?status=archived", headers=headers)
    assert any(str(p["id"]) == p1_id for p in arch.json()["items"])

    # duplicate archived p1 -> draft, +1 year, items copied
    dup = await client.post(f"/api/v1/schedules/periods/{p1_id}/duplicate", headers=headers)
    assert dup.status_code == 200, dup.text
    d = dup.json()
    dup_id = str(d["id"])
    assert d["status"] == "draft"
    assert d["period_start"] == "2027-09-01"
    assert d["period_end"] == "2027-12-31"
    assert d["lesson_count"] == 1
    ddetail = await client.get(f"/api/v1/schedules/periods/{dup_id}", headers=headers)
    assert len(ddetail.json()["items"]) == 1
    dup_item_id = str(ddetail.json()["items"][0]["id"])

    # update item inside copy
    upd = await client.patch(
        f"/api/v1/schedules/periods/items/{dup_item_id}",
        headers=headers,
        json={"start_time": "19:00"},
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["start_time"] == "19:00"
    assert upd.json()["day_of_week"] == 2

    # update period dates
    updp = await client.patch(
        f"/api/v1/schedules/periods/{dup_id}",
        headers=headers,
        json={"period_end": "2028-01-31"},
    )
    assert updp.status_code == 200, updp.text
    assert updp.json()["period_end"] == "2028-01-31"

    # invalid date range -> 422
    bad = await client.patch(
        f"/api/v1/schedules/periods/{dup_id}",
        headers=headers,
        json={"period_start": "2029-01-01", "period_end": "2028-01-01"},
    )
    assert bad.status_code == 422

    # archive copy (DELETE = soft archive)
    arch_del = await client.delete(f"/api/v1/schedules/periods/{dup_id}", headers=headers)
    assert arch_del.status_code == 200, arch_del.text
    assert arch_del.json()["ok"] is True

    # archived period is protected from changes
    blocked_patch = await client.patch(
        f"/api/v1/schedules/periods/items/{dup_item_id}",
        headers=headers,
        json={"room": "X"},
    )
    assert blocked_patch.status_code == 422
    blocked_add = await client.post(
        f"/api/v1/schedules/periods/{dup_id}/items",
        headers=headers,
        json={"day_of_week": 3, "start_time": "10:00", "end_time": "11:00"},
    )
    assert blocked_add.status_code == 422
    blocked_del = await client.delete(
        f"/api/v1/schedules/periods/items/{dup_item_id}",
        headers=headers,
    )
    assert blocked_del.status_code == 422
    blocked_approve = await client.post(
        f"/api/v1/schedules/periods/{dup_id}/approve", headers=headers,
    )
    assert blocked_approve.status_code == 422

    # delete item inside active p2 (allowed)
    p2_item = await client.post(
        f"/api/v1/schedules/periods/{p2_id}/items",
        headers=headers,
        json={"day_of_week": 5, "start_time": "10:00", "end_time": "11:30"},
    )
    assert p2_item.status_code == 200, p2_item.text
    rdel = await client.delete(
        f"/api/v1/schedules/periods/items/{p2_item.json()['id']}",
        headers=headers,
    )
    assert rdel.status_code == 200, rdel.text
    assert rdel.json()["ok"] is True

    # unknown period -> 404
    nf = await client.get(
        "/api/v1/schedules/periods/00000000-0000-0000-0000-000000000000", headers=headers,
    )
    assert nf.status_code == 404


async def test_schedules_periods_require_auth(client):
    resp = await client.get("/api/v1/schedules/periods")
    assert resp.status_code == 401
