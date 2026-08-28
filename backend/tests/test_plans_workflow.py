import pytest
from sqlalchemy import text

CENTER_ID = "11111111-1111-1111-1111-111111111111"
COACH_ID = "33333333-3333-3333-3333-333333333333"


def default_item(**overrides):
    payload = {
        "category": "СВ",
        "quarter": 3,
        "month": 8,
        "date": "2026-08-10",
        "name": "Учебно-тренировочный сбор",
        "location": "УТЦ",
        "participants_count": "15",
    }
    payload.update(overrides)
    return payload


async def make_plan(client, headers, year):
    resp = await client.post(
        "/api/v1/incentive/plans", json={"year": year}, headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def add_item(client, headers, plan_id, **overrides):
    resp = await client.post(
        f"/api/v1/incentive/plans/{plan_id}/items",
        json=default_item(**overrides),
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def get_plan(client, headers, plan_id):
    resp = await client.get(
        f"/api/v1/incentive/plans/{plan_id}", headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.fixture(scope="module")
def set_admin_center(session_maker):
    async def _set(center_id: str | None):
        async with session_maker() as session:
            await session.execute(
                text("UPDATE users SET center_id = :c WHERE email = 'admin@example.com'"),
                {"c": center_id},
            )
            await session.commit()

    return _set


async def test_coach_get_or_create_plan(client, auth):
    headers = auth["coach"]
    first = await make_plan(client, headers, 2026)
    assert first["year"] == 2026
    assert first["status"] == "draft"
    assert first["items"] == []
    assert first["coach_id"] == COACH_ID
    assert first["center_id"] == CENTER_ID
    assert first["coach_name"]
    assert first["coach_initials"]

    second = await make_plan(client, headers, 2026)
    assert second["id"] == first["id"]


async def test_create_plan_roles(client, auth):
    for role in ("admin", "director"):
        resp = await client.post(
            "/api/v1/incentive/plans",
            json={"year": 2027},
            headers=auth[role],
        )
        assert resp.status_code == 403, (role, resp.text)


async def test_plan_scoping(client, auth, set_admin_center):
    coach_headers = auth["coach"]
    await make_plan(client, coach_headers, 2028)

    own = await client.get("/api/v1/incentive/plans", headers=coach_headers)
    assert own.status_code == 200, own.text
    assert len([p for p in own.json() if p["year"] == 2028]) == 1

    filtered = await client.get(
        "/api/v1/incentive/plans?year=2029", headers=coach_headers,
    )
    assert filtered.json() == []

    director = await client.get("/api/v1/incentive/plans", headers=auth["director"])
    assert director.status_code == 200, director.text
    assert len(director.json()) >= 1

    await set_admin_center(None)
    admin_none = await client.get("/api/v1/incentive/plans", headers=auth["admin"])
    assert admin_none.status_code == 200, admin_none.text
    assert admin_none.json() == []

    await set_admin_center(CENTER_ID)
    admin_at = await client.get("/api/v1/incentive/plans", headers=auth["admin"])
    assert admin_at.status_code == 200, admin_at.text
    assert len(admin_at.json()) >= 1


async def test_get_plan_404(client, auth):
    resp = await client.get(
        f"/api/v1/incentive/plans/{'99999999-9999-9999-9999-999999999999'}",
        headers=auth["coach"],
    )
    assert resp.status_code == 404, resp.text


async def test_item_lifecycle_and_draft_rules(client, auth):
    headers = auth["coach"]
    plan = await make_plan(client, headers, 2030)
    plan_id = plan["id"]

    item = await add_item(client, headers, plan_id)
    item_id = item["id"]
    assert item["status"] == "draft"

    updated = await client.put(
        f"/api/v1/incentive/plans/items/{item_id}",
        json={"name": "СФП сбор", "participants_count": "20"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "СФП сбор"

    listed = await client.get(f"/api/v1/incentive/plans/{plan_id}/items", headers=headers)
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 1

    submitted = await client.post(
        f"/api/v1/incentive/plans/items/{item_id}/submit",
        headers=headers,
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["submitted_at"]

    after_submit = await client.put(
        f"/api/v1/incentive/plans/items/{item_id}",
        json={"name": "X"},
        headers=headers,
    )
    assert after_submit.status_code == 422, after_submit.text

    after_submit_del = await client.delete(
        f"/api/v1/incentive/plans/items/{item_id}",
        headers=headers,
    )
    assert after_submit_del.status_code == 422, after_submit_del.text


async def test_item_mutations_roles(client, auth):
    headers = auth["coach"]
    plan = await make_plan(client, headers, 2031)
    item = await add_item(client, headers, plan["id"])
    item_id = item["id"]

    for role in ("admin", "director"):
        resp = await client.post(
            f"/api/v1/incentive/plans/items/{item_id}/submit",
            headers=auth[role],
        )
        assert resp.status_code == 403, (role, resp.text)
        resp = await client.put(
            f"/api/v1/incentive/plans/items/{item_id}",
            json={"name": "X"},
            headers=auth[role],
        )
        assert resp.status_code == 403, (role, resp.text)


async def test_approve_by_director_and_admin(client, auth, set_admin_center):
    headers = auth["coach"]
    plan = await make_plan(client, headers, 2032)
    item = await add_item(client, headers, plan["id"])
    item_id = item["id"]

    await client.post(f"/api/v1/incentive/plans/items/{item_id}/submit", headers=headers)

    resp = await client.post(
        f"/api/v1/incentive/plans/items/{item_id}/approve",
        headers=auth["coach"],
    )
    assert resp.status_code in (403, 422), resp.text

    await set_admin_center(None)
    admin_no_center = await client.post(
        f"/api/v1/incentive/plans/items/{item_id}/approve",
        headers=auth["admin"],
    )
    assert admin_no_center.status_code == 403, admin_no_center.text

    await set_admin_center(CENTER_ID)
    listed = await client.get(f"/api/v1/incentive/plans/{plan['id']}/items", headers=headers)
    assert listed.status_code == 200, listed.text
    my_item_id = listed.json()[0]["id"]

    approved = await client.post(
        f"/api/v1/incentive/plans/items/{my_item_id}/approve",
        headers=auth["admin"],
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["reviewed_at"]

    reapprove = await client.post(
        f"/api/v1/incentive/plans/items/{my_item_id}/approve",
        headers=auth["director"],
    )
    assert reapprove.status_code == 422, reapprove.text


async def test_reject_requires_comment(client, auth):
    headers = auth["coach"]
    plan = await make_plan(client, headers, 2033)
    item = await add_item(client, headers, plan["id"])
    item_id = item["id"]
    await client.post(f"/api/v1/incentive/plans/items/{item_id}/submit", headers=headers)

    no_comment = await client.post(
        f"/api/v1/incentive/plans/items/{item_id}/reject",
        json={"comment": ""},
        headers=auth["director"],
    )
    assert no_comment.status_code == 422, no_comment.text

    rejected = await client.post(
        f"/api/v1/incentive/plans/items/{item_id}/reject",
        json={"comment": "Нет подтверждающих документов"},
        headers=auth["director"],
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert "документов" in rejected.json()["reviewer_comment"]


async def test_redraft_and_aggregate_status(client, auth):
    headers = auth["coach"]
    plan = await make_plan(client, headers, 2034)
    plan_id = plan["id"]

    first = await add_item(client, headers, plan_id, month=1)
    second = await add_item(client, headers, plan_id, month=2)

    assert (await get_plan(client, headers, plan_id))["status"] == "draft"

    await client.post(f"/api/v1/incentive/plans/items/{first['id']}/submit", headers=headers)
    assert (await get_plan(client, headers, plan_id))["status"] == "submitted"

    redraft_draft = await client.post(
        f"/api/v1/incentive/plans/items/{first['id']}/redraft",
        headers=headers,
    )
    assert redraft_draft.status_code == 422, redraft_draft.text

    await client.post(f"/api/v1/incentive/plans/items/{first['id']}/submit", headers=headers)
    await client.post(
        f"/api/v1/incentive/plans/items/{first['id']}/reject",
        json={"comment": "Доработайте"},
        headers=auth["director"],
    )
    assert (await get_plan(client, headers, plan_id))["status"] == "rejected"

    redrafted = await client.post(
        f"/api/v1/incentive/plans/items/{first['id']}/redraft",
        headers=headers,
    )
    assert redrafted.status_code == 200, redrafted.text
    assert redrafted.json()["status"] == "draft"
    assert redrafted.json()["reviewer_comment"] is None

    await client.post(f"/api/v1/incentive/plans/items/{first['id']}/submit", headers=headers)
    assert (await get_plan(client, headers, plan_id))["status"] == "submitted"

    for item_id in (first["id"], second["id"]):
        await client.post(
            f"/api/v1/incentive/plans/items/{item_id}/submit",
            headers=headers,
        )
        await client.post(
            f"/api/v1/incentive/plans/items/{item_id}/approve",
            headers=auth["director"],
        )
    assert (await get_plan(client, headers, plan_id))["status"] == "approved"


async def test_update_plan_draft_only_and_roles(client, auth):
    headers = auth["coach"]
    plan = await make_plan(client, headers, 2035)
    plan_id = plan["id"]
    item = await add_item(client, headers, plan_id)
    item_id = item["id"]

    moved = await client.put(
        f"/api/v1/incentive/plans/{plan_id}",
        json={"year": 2036},
        headers=headers,
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["year"] == 2036
    assert moved.json()["coach_id"] == COACH_ID

    shielded = await client.put(
        f"/api/v1/incentive/plans/{plan_id}",
        json={"year": 2037, "coach_id": COACH_ID, "center_id": CENTER_ID},
        headers=headers,
    )
    assert shielded.status_code == 200, shielded.text

    for role in ("admin", "director"):
        resp = await client.put(
            f"/api/v1/incentive/plans/{plan_id}",
            json={"year": 2038},
            headers=auth[role],
        )
        assert resp.status_code == 403, (role, resp.text)

    await client.post(
        f"/api/v1/incentive/plans/items/{item_id}/submit",
        headers=headers,
    )
    locked = await client.put(
        f"/api/v1/incentive/plans/{plan_id}",
        json={"year": 2039},
        headers=headers,
    )
    assert locked.status_code == 422, locked.text


async def test_delete_plan_admin_only(client, auth, set_admin_center):
    headers = auth["coach"]
    plan = await make_plan(client, headers, 2040)
    plan_id = plan["id"]
    await add_item(client, headers, plan_id)

    denied_coach = await client.delete(
        f"/api/v1/incentive/plans/{plan_id}", headers=headers,
    )
    assert denied_coach.status_code == 403, denied_coach.text

    denied_director = await client.delete(
        f"/api/v1/incentive/plans/{plan_id}", headers=auth["director"],
    )
    assert denied_director.status_code == 200, denied_director.text

    another = await make_plan(client, headers, 2041)
    await set_admin_center(None)
    admin_none = await client.delete(
        f"/api/v1/incentive/plans/{another['id']}", headers=auth["admin"],
    )
    assert admin_none.status_code == 403, admin_none.text

    await set_admin_center(CENTER_ID)
    admin_at = await client.delete(
        f"/api/v1/incentive/plans/{another['id']}", headers=auth["admin"],
    )
    assert admin_at.status_code == 200, admin_at.text

    gone = await client.get(
        f"/api/v1/incentive/plans/{another['id']}", headers=headers,
    )
    assert gone.status_code == 404, gone.text

    third = await make_plan(client, headers, 2042)
    item2 = await add_item(client, headers, third["id"])
    deleted = await client.delete(
        f"/api/v1/incentive/plans/{third['id']}",
        headers=auth["director"],
    )
    assert deleted.status_code == 200, deleted.text
    gone_items = await client.get(
        f"/api/v1/incentive/plans/{third['id']}/items", headers=headers,
    )
    assert gone_items.status_code == 404, gone_items.text
    orphan = await client.post(
        f"/api/v1/incentive/plans/items/{item2['id']}/submit",
        headers=headers,
    )
    assert orphan.status_code == 404, orphan.text
