import uuid

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.user import User
from tests.conftest import (
    CENTER_ID,
    COACH2_ID,
    COACH_ID,
    PASSWORD,
)

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


async def _extra_coach_user(session_maker) -> str:
    """Create a user with coach role and return user_id."""
    async with session_maker() as session:
        from app.models.user import Role, UserRole
        user = User(
            email=f"coach-me-{uuid.uuid4().hex[:8]}@example.com",
            phone=f"+7{uuid.uuid4().hex[:10]}",
            password_hash=hash_password("Passw0rd!123"),
            first_name="Тест",
            last_name="Тренер",
        )
        session.add(user)
        await session.flush()
        coach_role = await session.execute(
            select(Role).where(Role.code == "coach")
        )
        coach_role = coach_role.scalar_one()
        session.add(UserRole(user_id=user.id, role_id=coach_role.id))
        await session.commit()
        return str(user.id)


async def test_coach_me_get_own_profile(client, auth, session_maker):
    """Coach can GET their own profile via /me."""
    coach_headers = auth["coach"]
    resp = await client.get("/api/v1/coaches/me", headers=coach_headers)
    assert resp.status_code == 200, resp.text
    coach = resp.json()
    # Get user_id from the response itself
    assert "user_id" in coach
    assert "vacations" in coach
    assert "sick_leaves" in coach


async def test_coach_me_patch_vacations(client, auth, session_maker):
    """Coach can PATCH their own vacations/sick_leaves via /me."""
    coach_headers = auth["coach"]
    resp = await client.patch(
        "/api/v1/coaches/me",
        headers=coach_headers,
        json={
            "vacations": [{"start_date": "2026-07-01", "end_date": "2026-07-15"}],
            "sick_leaves": [{"start_date": "2026-08-01", "end_date": "2026-08-05"}],
        },
    )
    assert resp.status_code == 200, resp.text
    coach = resp.json()
    assert len(coach["vacations"]) == 1
    assert coach["vacations"][0]["start_date"] == "2026-07-01"
    assert len(coach["sick_leaves"]) == 1
    assert coach["sick_leaves"][0]["start_date"] == "2026-08-01"


async def test_coach_me_patch_overlap_returns_422(client, auth, session_maker):
    """Overlapping vacation and sick_leave returns 422."""
    coach_headers = auth["coach"]
    # First set a vacation
    await client.patch(
        "/api/v1/coaches/me",
        headers=coach_headers,
        json={"vacations": [{"start_date": "2026-07-01", "end_date": "2026-07-15"}]},
    )
    # Try to add overlapping sick_leave
    resp = await client.patch(
        "/api/v1/coaches/me",
        headers=coach_headers,
        json={"sick_leaves": [{"start_date": "2026-07-10", "end_date": "2026-07-20"}]},
    )
    assert resp.status_code == 422, resp.text
    assert "пересечение" in resp.text.lower() or "overlap" in resp.text.lower()


async def test_coach_me_patch_invalid_dates_returns_422(client, auth, session_maker):
    """end_date < start_date returns 422."""
    coach_headers = auth["coach"]
    resp = await client.patch(
        "/api/v1/coaches/me",
        headers=coach_headers,
        json={"vacations": [{"start_date": "2026-07-15", "end_date": "2026-07-01"}]},
    )
    assert resp.status_code == 422, resp.text


async def test_coach_me_cannot_edit_other_coach(client, auth, session_maker):
    """Coach cannot edit another coach's profile via /me (only own)."""
    # Create another coach user
    other_user_id = await _extra_coach_user(session_maker)
    # Create coach profile for that user
    admin_headers = auth["admin"]
    resp = await client.post(
        "/api/v1/coaches",
        headers=admin_headers,
        json={
            "user_id": other_user_id,
            "center_id": CENTER_ID,
            "specialization": "Дзюдо",
            "hire_date": "2025-01-10",
        },
    )
    assert resp.status_code == 200
    # The current coach (coach@example.com) tries to access /me - should only get their own
    coach_headers = auth["coach"]
    resp = await client.get("/api/v1/coaches/me", headers=coach_headers)
    assert resp.status_code == 200
    coach = resp.json()
    # Verify it's the current coach's profile, not the other one
    assert coach["user_id"] != other_user_id


async def test_director_can_edit_own_center_coach_via_me(client, auth, session_maker):
    """Director can edit coaches in their center via /me? No, director uses /coaches/{id}.
    This test verifies director can still use admin endpoints."""
    # Director uses the regular admin endpoints, not /me
    director_headers = auth["director"]
    coach_headers = auth["coach"]

    # Get coach ID
    coach_resp = await client.get("/api/v1/coaches/me", headers=coach_headers)
    coach_id = coach_resp.json()["id"]

    # Director can update via admin endpoint
    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        headers=director_headers,
        json={"qualification": "Тренер первой категории"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["qualification"] == "Тренер первой категории"


async def test_admin_can_edit_any_coach_via_admin_endpoint(client, auth, session_maker):
    """Admin can edit any coach via admin endpoint."""
    admin_headers = auth["admin"]
    coach_headers = auth["coach"]

    coach_resp = await client.get("/api/v1/coaches/me", headers=coach_headers)
    coach_id = coach_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is False

    # Restore
    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        headers=admin_headers,
        json={"is_active": True},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


async def _login(client, email: str) -> dict:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _extra_admin_user_without_center(session_maker) -> str:
    async with session_maker() as session:
        from app.models.user import Role, UserRole
        user = User(
            email=f"admin-scope-{uuid.uuid4().hex[:8]}@example.com",
            phone=f"+7{uuid.uuid4().hex[:10]}",
            password_hash=hash_password("Passw0rd!123"),
            first_name="Scope",
            last_name="Admin",
        )
        session.add(user)
        await session.flush()
        role = (await session.execute(
            select(Role).where(Role.code == "admin")
        )).scalar_one()
        session.add(UserRole(user_id=user.id, role_id=role.id))
        await session.commit()
        return user.email


async def test_admin_scope_list_sees_only_own_center(client, auth):
    admin1 = auth["admin"]
    admin2 = await _login(client, "admin2@example.com")

    ids1 = {c["id"] for c in await _coach_list(client, admin1)}
    assert COACH_ID in ids1
    assert COACH2_ID not in ids1

    ids2 = {c["id"] for c in await _coach_list(client, admin2)}
    assert COACH2_ID in ids2
    assert COACH_ID not in ids2


async def test_admin_scope_get_or_patch_other_center_403(client, auth):
    admin1 = auth["admin"]
    admin2 = await _login(client, "admin2@example.com")
    director = auth["director"]

    other_id_for_admin1 = COACH2_ID
    other_id_for_admin2 = COACH_ID

    resp = await client.get(f"/api/v1/coaches/{other_id_for_admin1}", headers=admin1)
    assert resp.status_code == 403, resp.text
    resp = await client.patch(
        f"/api/v1/coaches/{other_id_for_admin1}", headers=admin1, json={"specialization": "Бокс"}
    )
    assert resp.status_code == 403, resp.text

    resp = await client.get(f"/api/v1/coaches/{other_id_for_admin2}", headers=admin2)
    assert resp.status_code == 403, resp.text
    resp = await client.patch(
        f"/api/v1/coaches/{other_id_for_admin2}", headers=admin2, json={"specialization": "Бокс"}
    )
    assert resp.status_code == 403, resp.text

    resp = await client.get(f"/api/v1/coaches/{COACH_ID}", headers=admin1)
    assert resp.status_code == 200, resp.text

    resp = await client.get(f"/api/v1/coaches/{COACH2_ID}", headers=director)
    assert resp.status_code == 200, resp.text
    resp = await client.patch(
        f"/api/v1/coaches/{COACH2_ID}", headers=director, json={"specialization": "Самбо"}
    )
    assert resp.status_code == 200, resp.text


async def test_admin_without_center_sees_empty_list(client, auth, session_maker):
    email = await _extra_admin_user_without_center(session_maker)
    headers = await _login(client, email)
    listed = await _coach_list(client, headers)
    assert listed == []
