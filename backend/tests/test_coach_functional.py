import uuid

import pytest

from tests.conftest import CENTER_ID, COACH_ID, REGION_ID

pytestmark = pytest.mark.asyncio


# ── Coach basic RBAC ──────────────────────────────────────────────────────
async def test_coach_rbac_basic(client, auth):
    """Verify coach can read what they're allowed to."""
    headers = auth["coach"]

    # ✅ Allowed: read-only endpoints (status 200)
    resp = await client.get("/api/v1/athletes", headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/groups", headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/schedules/periods", headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/attendance", params={"date": "2026-09-01"}, headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/events", headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/documents", headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/reports", headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/incentive/plans", headers=headers)
    assert resp.status_code == 200


# ── Coach CAN create athletes/groups (RBAC allows coach role) ─────────────
async def test_coach_can_create_athletes(client, auth):
    """Coach can create athletes - RBAC allows coach role in athletes router."""
    headers = auth["coach"]
    resp = await client.post("/api/v1/athletes", headers=headers, json={
        "first_name": "TestAth", "last_name": "Count",
        "birth_date": "2010-01-01", "gender": "m",
        "sport_type": "Самбо", "center_id": CENTER_ID, "coach_id": COACH_ID
    })
    # Coach CAN create athletes based on require_roles("coach", "admin", "director")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"


async def test_coach_can_create_groups(client, auth):
    """Coach can create groups - RBAC allows coach role in groups router."""
    headers = auth["coach"]
    resp = await client.post("/api/v1/groups", headers=headers, json={
        "name": "Test Grp", "sport_type": "Самбо", "center_id": CENTER_ID, "coach_id": COACH_ID
    })
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"


# ── What coach CANNOT do (403 Forbidden) ─────────────────────────────────
async def test_coach_cannot_create_center(client, auth):
    """Coach cannot create centers - only admin/director/superadmin."""
    headers = auth["coach"]
    resp = await client.post("/api/v1/organizations/centers", headers=headers, json={"name": "X", "region_id": REGION_ID})
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"


async def test_coach_cannot_create_coaches(client, auth):
    """Coach cannot create other coaches - requires admin/director."""
    headers = auth["coach"]
    resp = await client.post("/api/v1/coaches", headers=headers, json={
        "user_id": str(uuid.uuid4()), "specialization": "Дзюдо", "hire_date": "2025-01-10"
    })
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}: {resp.text}"


async def test_coach_cannot_create_protocols(client, auth):
    """Coach cannot create incentive protocols - requires admin/director."""
    headers = auth["coach"]
    resp = await client.post("/api/v1/incentive/protocols", headers=headers, json={
        "number": "P-1", "date": "2026-08-01", "beneficiary_name": "Благополучатель",
        "period": "3 кв. 2026", "center_id": CENTER_ID
    })
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"


# ── Summary: coach can do vs cannot do ──────────────────────────────────
async def test_coach_permissions_summary(client, auth):
    """Final summary - coach capabilities."""
    headers = auth["coach"]

    # ✅ Coach CAN do (read + some write):
    read_endpoints = [
        "/api/v1/athletes", "/api/v1/groups", "/api/v1/schedules/periods",
        "/api/v1/attendance", "/api/v1/events", "/api/v1/documents",
        "/api/v1/reports", "/api/v1/incentive/plans"
    ]
    for ep in read_endpoints:
        resp = await client.get(ep, headers=headers)
        assert resp.status_code == 200, f"Read failed for {ep}"

    # ✅ Coach CAN create (based on RBAC):
    await test_coach_can_create_athletes(client, auth)
    await test_coach_can_create_groups(client, auth)

    # ❌ Coach CANNOT do:
    await test_coach_cannot_create_center(client, auth)
    await test_coach_cannot_create_coaches(client, auth)
    await test_coach_cannot_create_protocols(client, auth)