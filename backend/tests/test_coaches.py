import uuid

import pytest

from app.core.security import hash_password
from app.models.user import User
from tests.conftest import CENTER_ID

pytestmark = pytest.mark.asyncio


async def _coach_list(client, headers):
    resp = await client.get("/api/v1/coaches?per_page=100", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()[0]


async def _extra_user(session_maker) -> str:
    async with session_maker() as session:
        user = User(
            email=f"coach2-{uuid.uuid4().hex[:8]}@example.com",
            phone=f"+7{uuid.uuid4().hex[:10]}",
            password_hash=hash_password("Passw0rd!123"),
            first_name="Степан",
            last_name="Тренеров",
        )
        session.add(user)
        await session.commit()
        return str(user.id)


async def test_coaches_rbac(client, auth):
    coach_headers = auth["coach"]
    admin_headers = auth["admin"]

    resp = await client.get("/api/v1/coaches", headers=coach_headers)
    assert resp.status_code == 200

    resp = await client.post(
        "/api/v1/coaches",
        headers=coach_headers,
        json={
            "user_id": str(uuid.uuid4()),
            "specialization": "Дзюдо",
            "hire_date": "2025-01-10",
        },
    )
    assert resp.status_code in (401, 403)

    existing = (await client.get("/api/v1/coaches", headers=admin_headers)).json()[0]
    coach_id = existing[0]["id"]

    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        headers=coach_headers,
        json={"qualification": "Тренер первой категории"},
    )
    assert resp.status_code in (401, 403)

    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        headers=admin_headers,
        json={"qualification": "Тренер первой категории"},
    )
    assert resp.status_code == 200, resp.text


async def test_coaches_create_list_enrich(client, auth, session_maker):
    headers = auth["superadmin"]
    user_id = await _extra_user(session_maker)

    resp = await client.post(
        "/api/v1/coaches",
        headers=headers,
        json={
            "user_id": user_id,
            "center_id": CENTER_ID,
            "specialization": "Самбо",
            "qualification": "Тренер высшей категории",
            "hire_date": "2025-01-10",
            "vacations": [{"start_date": "2026-08-01", "end_date": "2026-08-20"}],
            "sick_leaves": [{"start_date": "2026-03-01", "end_date": "2026-03-05"}],
        },
    )
    assert resp.status_code == 200, resp.text
    coach = resp.json()
    coach_id = coach["id"]
    assert coach["name"] == "Тренеров Степан"
    assert coach["center_name"] == "ЦСЕ Тест"
    assert coach["groups_count"] == 0
    assert coach["athletes_count"] == 0
    assert len(coach["vacations"]) == 1
    assert len(coach["sick_leaves"]) == 1

    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": f"Ath{uuid.uuid4().hex[:6]}",
            "last_name": "Count",
            "birth_date": "2010-01-01",
            "gender": "m",
            "sport_type": "Самбо",
            "center_id": CENTER_ID,
            "coach_id": coach_id,
        },
    )
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/groups",
        headers=headers,
        json={
            "name": f"Группа {uuid.uuid4().hex[:6]}",
            "sport_type": "Самбо",
            "coach_id": coach_id,
            "center_id": CENTER_ID,
        },
    )
    assert resp.status_code == 200, resp.text

    listed = await _coach_list(client, headers)
    updated = next(c for c in listed if c["id"] == coach_id)
    assert updated["groups_count"] >= 1
    assert updated["athletes_count"] >= 1
    assert updated["athletes_count"] == updated["groups_count"] == 1


async def test_coaches_update_vacations_and_archive(client, auth, session_maker):
    headers = auth["admin"]
    user_id = await _extra_user(session_maker)

    resp = await client.post(
        "/api/v1/coaches",
        headers=headers,
        json={
            "user_id": user_id,
            "center_id": CENTER_ID,
            "specialization": "Бокс",
            "hire_date": "2024-02-01",
        },
    )
    assert resp.status_code == 200, resp.text
    coach_id = resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        headers=headers,
        json={
            "is_active": False,
            "vacations": [
                {"start_date": "2026-09-01", "end_date": "2026-09-15"},
                {"start_date": "2026-12-01", "end_date": "2026-12-20"},
            ],
            "sick_leaves": [],
        },
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()
    assert updated["is_active"] is False
    assert len(updated["vacations"]) == 2
    assert updated["sick_leaves"] == []

    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        headers=headers,
        json={"is_active": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is True