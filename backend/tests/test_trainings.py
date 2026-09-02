import pytest

from tests.conftest import CENTER2_ID, CENTER_ID, COACH_ID, PASSWORD

FIXED_NAME = "Тренировка с сотрудниками РУСАЛа"
DAY_A = "2030-11-05"
DAY_B = "2030-11-06"


@pytest.fixture(autouse=True)
async def clean_trainings(session_maker):
    """Isolate trainings + plan-sync rows (shared session-scoped DB)."""
    async with session_maker() as session:
        from sqlalchemy import text

        rows = (await session.execute(
            text("SELECT t.id, t.plan_item_id, p.plan_id "
                 "FROM trainings t LEFT JOIN plan_items p ON p.id = t.plan_item_id"),
        )).all()
        await session.execute(text("DELETE FROM trainings"))
        for row in rows:
            item_id, plan_id = row[1], row[2]
            if item_id:
                await session.execute(
                    text("DELETE FROM plan_items WHERE id = :i"), {"i": item_id},
                )
            if plan_id:
                await session.execute(
                    text("DELETE FROM event_plans WHERE id = :p"), {"p": plan_id},
                )
        await session.commit()


async def _login(client, email: str) -> dict[str, str]:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_slot(client, headers, day=DAY_A, start_time="18:00", location="Зал А"):
    resp = await client.post(
        "/api/v1/trainings",
        headers=headers,
        json={
            "date": day,
            "start_time": start_time,
            "location": location,
            "center_id": CENTER_ID,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _select_slot(client, headers, training_id, goal="Цель А"):
    return await client.post(
        f"/api/v1/trainings/{training_id}/select",
        headers=headers,
        json={"goal": goal},
    )


async def _plan_items_count(session_maker) -> int:
    async with session_maker() as session:
        from sqlalchemy import text

        (count,) = (await session.execute(
            text("SELECT count(*) FROM plan_items WHERE name = :n"), {"n": FIXED_NAME},
        )).one()
        return count


async def test_rbac_and_center_scope(client, auth, session_maker):
    as_coach = await client.post(
        "/api/v1/trainings",
        headers=auth["coach"],
        json={"date": DAY_A, "start_time": "18:00", "location": "Зал А"},
    )
    assert as_coach.status_code == 403

    slot = await _create_slot(client, auth["admin"])
    assert slot["status"] == "proposed"
    assert slot["center_id"] == CENTER_ID
    assert slot["coach_id"] is None
    assert slot["location"] == "Зал А"

    listed = await client.get("/api/v1/trainings", headers=auth["admin"])
    assert listed.status_code == 200
    assert any(s["id"] == slot["id"] for s in listed.json())

    admin2 = await _login(client, "admin2@example.com")
    foreign = await client.patch(
        f"/api/v1/trainings/{slot['id']}",
        headers=admin2,
        json={"location": "Чужой зал"},
    )
    assert foreign.status_code == 403

    foreign_list = await client.get("/api/v1/trainings", headers=admin2)
    assert foreign_list.status_code == 200
    assert all(s["center_id"] == CENTER2_ID for s in foreign_list.json())

    as_patch = await client.patch(
        f"/api/v1/trainings/{slot['id']}",
        headers=auth["coach"],
        json={"location": "X"},
    )
    assert as_patch.status_code == 403

    as_delete = await client.delete(
        f"/api/v1/trainings/{slot['id']}", headers=auth["coach"],
    )
    assert as_delete.status_code == 403

    as_cancel = await client.post(
        f"/api/v1/trainings/{slot['id']}/cancel", headers=auth["coach"],
    )
    assert as_cancel.status_code == 403


async def test_admin_crud_guard(client, auth):
    slot = await _create_slot(client, auth["admin"])

    updated = await client.patch(
        f"/api/v1/trainings/{slot['id']}",
        headers=auth["admin"],
        json={"location": "Зал Б", "start_time": "19:30"},
    )
    assert updated.status_code == 200
    assert updated.json()["location"] == "Зал Б"
    assert updated.json()["start_time"] == "19:30:00"

    duplicate = await client.patch(
        f"/api/v1/trainings/{slot['id']}",
        headers=auth["admin"],
        json={},
    )
    assert duplicate.status_code == 422

    deleted = await client.delete(
        f"/api/v1/trainings/{slot['id']}", headers=auth["admin"],
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"ok": True}

    gone = await client.get("/api/v1/trainings", headers=auth["admin"])
    assert all(s["id"] != slot["id"] for s in gone.json())


async def test_select_confirms_and_syncs_plan(client, auth, session_maker):
    slot = await _create_slot(client, auth["admin"])

    selected = await _select_slot(client, auth["coach"], slot["id"])
    assert selected.status_code == 200, selected.text
    body = selected.json()
    assert body["status"] == "confirmed"
    assert body["coach_id"] == COACH_ID
    assert body["coach_name"] == "Test coach"
    assert body["participants_count"] is None
    assert body["goal"] == "Цель А"
    assert body["plan_item_id"] is not None

    async with session_maker() as session:
        from sqlalchemy import text

        item = (await session.execute(
            text("SELECT category, quarter, month, date, name, location, "
                 "participants_count, status FROM plan_items WHERE id = :i"),
            {"i": body["plan_item_id"]},
        )).one()
        assert item.name == FIXED_NAME
        assert item.category == "4"
        assert item.quarter == 4
        assert item.month == 11
        assert item.date == "05.11.2030"
        assert item.location == "Зал А"
        assert item.participants_count is None
        assert item.status == "draft"


async def test_one_slot_per_day(client, auth, session_maker):
    first = await _create_slot(client, auth["admin"], start_time="18:00")
    second = await _create_slot(client, auth["admin"], start_time="20:00")

    ok = await _select_slot(client, auth["coach"], first["id"])
    assert ok.status_code == 200, ok.text

    conflict = await _select_slot(client, auth["coach"], second["id"])
    assert conflict.status_code == 422
    assert "в этот день" in conflict.json()["detail"]

    other_day = await _create_slot(client, auth["admin"], day=DAY_B)
    fine = await _select_slot(client, auth["coach"], other_day["id"])
    assert fine.status_code == 200, fine.text

    taken = await _select_slot(client, auth["coach"], first["id"])
    assert taken.status_code == 422


async def test_cancel_confirmed_removes_plan_item(client, auth, session_maker):
    slot = await _create_slot(client, auth["admin"])
    res = await _select_slot(client, auth["coach"], slot["id"])
    assert res.status_code == 200

    cancelled = await client.post(
        f"/api/v1/trainings/{slot['id']}/cancel", headers=auth["admin"],
    )
    assert cancelled.status_code == 200, cancelled.text
    body = cancelled.json()
    assert body["status"] == "proposed"
    assert body["coach_id"] is None
    assert body["participants_count"] is None
    assert body["goal"] is None
    assert body["plan_item_id"] is None

    assert await _plan_items_count(session_maker) == 0

    again = await client.post(
        f"/api/v1/trainings/{slot['id']}/cancel", headers=auth["admin"],
    )
    assert again.status_code == 422

    admin2 = await _login(client, "admin2@example.com")
    foreign = await client.post(
        f"/api/v1/trainings/{slot['id']}/cancel", headers=admin2,
    )
    assert foreign.status_code == 403


async def test_mutations_guarded_after_confirmation(client, auth, session_maker):
    slot = await _create_slot(client, auth["admin"])
    assert (await _select_slot(client, auth["coach"], slot["id"])).status_code == 200

    updated = await client.patch(
        f"/api/v1/trainings/{slot['id']}",
        headers=auth["admin"],
        json={"location": "Зал В"},
    )
    assert updated.status_code == 422

    deleted = await client.delete(
        f"/api/v1/trainings/{slot['id']}", headers=auth["admin"],
    )
    assert deleted.status_code == 422


async def test_foreign_center_coach_cannot_select(client, auth):
    admin2 = await _login(client, "admin2@example.com")
    slot2 = await client.post(
        "/api/v1/trainings",
        headers=admin2,
        json={
            "date": DAY_A,
            "start_time": "18:00",
            "location": "Зал C2",
            "center_id": CENTER2_ID,
        },
    )
    assert slot2.status_code == 200, slot2.text

    coach2 = await _login(client, "coach2@example.com")

    coach1_try = await _select_slot(client, auth["coach"], slot2.json()["id"])
    assert coach1_try.status_code == 403

    resp = await _select_slot(client, coach2, slot2.json()["id"])
    assert resp.status_code == 200, resp.text


async def test_attendance_confirmed_sets_count_and_syncs_plan(client, auth, session_maker):
    slot = await _create_slot(client, auth["admin"])
    assert (await _select_slot(client, auth["coach"], slot["id"])).status_code == 200

    resp = await client.post(
        f"/api/v1/trainings/{slot['id']}/attendance",
        headers=auth["coach"],
        json={"participants_count": 15},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "confirmed"
    assert body["participants_count"] == 15

    async with session_maker() as session:
        from sqlalchemy import text

        (plan_count,) = (await session.execute(
            text("SELECT participants_count FROM plan_items WHERE id = :i"),
            {"i": body["plan_item_id"]},
        )).one()
        assert plan_count == "15"

    again = await client.post(
        f"/api/v1/trainings/{slot['id']}/attendance",
        headers=auth["coach"],
        json={"participants_count": 9},
    )
    assert again.status_code == 200, again.text
    assert again.json()["participants_count"] == 9

    async with session_maker() as session:
        from sqlalchemy import text

        (plan_count,) = (await session.execute(
            text("SELECT participants_count FROM plan_items WHERE id = :i"),
            {"i": body["plan_item_id"]},
        )).one()
        assert plan_count == "9"


async def test_attendance_guards(client, auth):
    slot = await _create_slot(client, auth["admin"])

    before = await client.post(
        f"/api/v1/trainings/{slot['id']}/attendance",
        headers=auth["coach"],
        json={"participants_count": 5},
    )
    assert before.status_code == 422
    assert "только для подтверждённой" in before.json()["detail"]

    assert (await _select_slot(client, auth["coach"], slot["id"])).status_code == 200

    for bad in (0, 31):
        resp = await client.post(
            f"/api/v1/trainings/{slot['id']}/attendance",
            headers=auth["coach"],
            json={"participants_count": bad},
        )
        assert resp.status_code == 422, bad

    admin2 = await _login(client, "admin2@example.com")
    slot2 = await client.post(
        "/api/v1/trainings",
        headers=admin2,
        json={
            "date": DAY_A,
            "start_time": "18:00",
            "location": "Зал C2",
            "center_id": CENTER2_ID,
        },
    )
    assert slot2.status_code == 200, slot2.text
    coach2 = await _login(client, "coach2@example.com")
    assert (await _select_slot(client, coach2, slot2.json()["id"])).status_code == 200

    foreign_coach = await client.post(
        f"/api/v1/trainings/{slot2.json()['id']}/attendance",
        headers=auth["coach"],
        json={"participants_count": 5},
    )
    assert foreign_coach.status_code == 403

    foreign_admin = await client.post(
        f"/api/v1/trainings/{slot['id']}/attendance",
        headers=admin2,
        json={"participants_count": 5},
    )
    assert foreign_admin.status_code == 403

    admin_ok = await client.post(
        f"/api/v1/trainings/{slot2.json()['id']}/attendance",
        headers=admin2,
        json={"participants_count": 7},
    )
    assert admin_ok.status_code == 200, admin_ok.text