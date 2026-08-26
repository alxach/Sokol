import pytest

from tests.conftest import CENTER_ID

pytestmark = pytest.mark.asyncio


PROTECTED_ENDPOINTS = [
    ("GET", "/api/v1/athletes"),
    ("POST", "/api/v1/athletes"),
    ("GET", "/api/v1/groups"),
    ("GET", "/api/v1/schedules/by-group/x"),
    ("GET", "/api/v1/attendance?date=2026-08-01"),
    ("GET", "/api/v1/events"),
    ("GET", "/api/v1/documents"),
    ("GET", "/api/v1/reports"),
    ("GET", "/api/v1/incentive/plans"),
    ("GET", "/api/v1/coaches"),
]


@pytest.mark.parametrize("method,url", PROTECTED_ENDPOINTS)
async def test_anonymous_gets_401(client, method, url):
    resp = await client.request(method, url)
    assert resp.status_code == 401, f"{method} {url}: {resp.status_code}"


@pytest.mark.parametrize("method,url", [
    ("GET", "/api/v1/exports/excel/athletes"),
    ("GET", "/api/v1/audit-logs"),
    ("GET", "/api/v1/analytics/dashboard"),
])
async def test_anonymous_gets_401_admin_area(client, method, url):
    resp = await client.request(method, url)
    assert resp.status_code == 401, f"{method} {url}: {resp.status_code}"


@pytest.mark.asyncio
async def test_coach_forbidden_on_exports(client, auth):
    resp = await client.get("/api/v1/exports/excel/athletes", headers=auth["coach"])
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_coach_forbidden_on_audit(client, auth):
    resp = await client.get("/api/v1/audit-logs", headers=auth["coach"])
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_allowed_on_exports(client, auth):
    resp = await client.get("/api/v1/exports/excel/athletes", headers=auth["admin"])
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_coach_cannot_create_center(client, auth):
    resp = await client.post(
        "/api/v1/organizations/centers",
        json={"name": "X", "region_id": "00000000-0000-0000-0000-000000000001"},
        headers=auth["coach"],
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_coach_can_read_regions(client, auth):
    resp = await client.get("/api/v1/organizations/regions", headers=auth["coach"])
    assert resp.status_code == 200


@pytest.mark.parametrize("role", ["admin", "director"])
async def test_protocols_require_manager_roles(client, auth, role):
    body = {
        "number": "P-1",
        "date": "2026-08-01",
        "beneficiary_name": "Благополучатель",
        "period": "3 кв. 2026",
        "center_id": CENTER_ID,
    }
    resp = await client.post("/api/v1/incentive/protocols", json=body, headers=auth[role])
    # 404/422 possible (center FK) but never 401/403 — role check passed
    assert resp.status_code not in (401, 403)


async def test_coach_forbidden_on_protocols(client, auth):
    body = {
        "number": "P-2",
        "date": "2026-08-01",
        "beneficiary_name": "Благополучатель",
        "period": "3 кв. 2026",
        "center_id": CENTER_ID,
    }
    resp = await client.post("/api/v1/incentive/protocols", json=body, headers=auth["coach"])
    assert resp.status_code == 403
