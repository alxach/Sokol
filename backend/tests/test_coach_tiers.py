import uuid

import pytest
from sqlalchemy import text

from tests.conftest import CENTER_ID, COACH_ID

pytestmark = pytest.mark.asyncio

OTHER_REGION_ID = "88888888-8888-8888-8888-888888888888"
OTHER_CENTER_ID = "99999999-9999-9999-9999-999999999999"
OTHER_USER_ID = "44444444-4444-4444-4444-444444444444"
OTHER_COACH_ID = "55555555-5555-5555-5555-555555555555"


@pytest.fixture(scope="module")
def _other_coach(session_maker):
    async def _ensure() -> str:
        async with session_maker() as session:
            await session.execute(
                text("INSERT INTO regions (id, name, code) VALUES (:id, 'Регион 2', 'TR2') "
                     "ON CONFLICT (id) DO NOTHING"),
                {"id": OTHER_REGION_ID},
            )
            await session.execute(
                text("INSERT INTO centers (id, region_id, name, address, center_type, is_active) "
                     "VALUES (:id, :rid, 'ЦСЕ Другой', 'addr2', 'cse', true) "
                     "ON CONFLICT (id) DO NOTHING"),
                {"id": OTHER_CENTER_ID, "rid": OTHER_REGION_ID},
            )
            await session.execute(
                text("INSERT INTO users (id, email, phone, password_hash, first_name, last_name, is_active) "
                     "VALUES (:id, 'othercoach@example.com', '+79990000001', 'x', 'Другой', 'Тренер', true) "
                     "ON CONFLICT (id) DO NOTHING"),
                {"id": OTHER_USER_ID},
            )
            await session.execute(
                text("INSERT INTO coaches (id, user_id, center_id, specialization, is_active, hire_date) "
                     "VALUES (:id, :uid, :cid, 'Дзюдо', true, CURRENT_DATE) "
                     "ON CONFLICT (id) DO NOTHING"),
                {"id": OTHER_COACH_ID, "uid": OTHER_USER_ID, "cid": OTHER_CENTER_ID},
            )
            await session.commit()
        return OTHER_COACH_ID

    return _ensure


def _criteria_payload(**overrides):
    payload = {
        "athletes_full": 30,
        "athletes_basic": 15,
        "hours_full": 9.0,
        "hours_basic": 4.5,
        "social_events_full": 2,
        "social_events_basic": 1,
        "sports_events_full": 2,
        "sports_events_basic": 1,
        "development_events_full": 2,
        "development_events_basic": 1,
    }
    payload.update(overrides)
    return payload


async def test_admin_lists_tiers_of_own_center(client, auth):
    resp = await client.get("/api/v1/incentive/coach-tiers", headers=auth["admin"])
    assert resp.status_code == 200, resp.text
    own = [t for t in resp.json() if t["coach_id"] == COACH_ID]
    assert own and own[0]["tier"] is None
    assert own[0]["coach_name"]
    assert own[0]["specialization"]

    # Запрос чужого центра игнорируется — администратор видит только свой центр.
    resp = await client.get(
        "/api/v1/incentive/coach-tiers",
        params={"center_id": OTHER_CENTER_ID},
        headers=auth["admin"],
    )
    assert any(t["coach_id"] == COACH_ID for t in resp.json())


async def test_director_and_superadmin_any_center(client, auth, _other_coach):
    other_id = await _other_coach()
    for role in ("director", "superadmin"):
        resp = await client.get(
            "/api/v1/incentive/coach-tiers",
            params={"center_id": OTHER_CENTER_ID},
            headers=auth[role],
        )
        assert resp.status_code == 200, resp.text
        assert any(t["coach_id"] == other_id for t in resp.json())


async def test_coach_cannot_view_or_set_tiers(client, auth):
    resp = await client.get("/api/v1/incentive/coach-tiers", headers=auth["coach"])
    assert resp.status_code == 403
    resp = await client.put(
        f"/api/v1/incentive/coach-tiers/{COACH_ID}",
        json={"tier": "full"},
        headers=auth["coach"],
    )
    assert resp.status_code == 403


async def test_admin_sets_own_center_tier(client, auth):
    resp = await client.put(
        f"/api/v1/incentive/coach-tiers/{COACH_ID}",
        json={"tier": "basic"},
        headers=auth["admin"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tier"] == "basic"
    assert body["coach_id"] == COACH_ID

    resp = await client.put(
        f"/api/v1/incentive/coach-tiers/{COACH_ID}",
        json={"tier": "full"},
        headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json()["tier"] == "full"


async def test_admin_cannot_set_tier_in_other_center(client, auth, _other_coach):
    other_id = await _other_coach()
    resp = await client.put(
        f"/api/v1/incentive/coach-tiers/{other_id}",
        json={"tier": "full"},
        headers=auth["admin"],
    )
    assert resp.status_code == 403


async def test_invalid_tier_rejected(client, auth):
    resp = await client.put(
        f"/api/v1/incentive/coach-tiers/{COACH_ID}",
        json={"tier": "ultra"},
        headers=auth["admin"],
    )
    assert resp.status_code == 422


async def test_unknown_coach_404(client, auth):
    resp = await client.put(
        f"/api/v1/incentive/coach-tiers/{uuid.uuid4()}",
        json={"tier": "full"},
        headers=auth["superadmin"],
    )
    assert resp.status_code == 404


async def test_criteria_carries_assigned_tier(client, auth):
    await client.put(
        f"/api/v1/incentive/criteria/{CENTER_ID}",
        json=_criteria_payload(),
        headers=auth["admin"],
    )
    await client.put(
        f"/api/v1/incentive/coach-tiers/{COACH_ID}",
        json={"tier": "full"},
        headers=auth["admin"],
    )
    resp = await client.get("/api/v1/incentive/criteria", headers=auth["coach"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body
    assert body[0]["center_id"] == CENTER_ID
    assert body[0]["assigned_tier"] == "full"