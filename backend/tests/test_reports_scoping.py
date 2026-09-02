import uuid

import pytest

from tests.conftest import CENTER2_ID, PASSWORD

pytestmark = pytest.mark.asyncio


async def _login(client, email: str) -> dict:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _mk_report(client, coach_headers: dict, admin_headers: dict) -> str:
    tpl = {
        "name": "Скоуп",
        "code": f"scoping-{uuid.uuid4().hex[:8]}",
        "report_type": "monthly",
        "structure_json": {"fields": []},
    }
    resp = await client.post("/api/v1/reports/templates", json=tpl, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    template_id = resp.json()["id"]

    report = {
        "template_id": template_id,
        "period_type": "monthly",
        "period_start": "2026-08-01",
        "period_end": "2026-08-31",
        "data_json": {"athletes_count": 12},
    }
    resp = await client.post("/api/v1/reports", json=report, headers=coach_headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


async def test_admin_sees_only_own_center_reports(client, auth):
    admin2 = await _login(client, "admin2@example.com")
    coach2 = await _login(client, "coach2@example.com")

    report_c1 = await _mk_report(client, auth["coach"], auth["admin"])
    report_c2 = await _mk_report(client, coach2, admin2)

    def _ids(items):
        return {r["id"] for r in items}

    admin1 = (await client.get("/api/v1/reports", headers=auth["admin"])).json()[0]
    assert report_c1 in _ids(admin1)
    assert report_c2 not in _ids(admin1)

    admin1_forced = (
        await client.get(
            f"/api/v1/reports?center_id={CENTER2_ID}", headers=auth["admin"],
        )
    ).json()[0]
    assert report_c1 in _ids(admin1_forced)
    assert report_c2 not in _ids(admin1_forced)

    admin2_list = (await client.get("/api/v1/reports", headers=admin2)).json()[0]
    assert report_c2 in _ids(admin2_list)
    assert report_c1 not in _ids(admin2_list)


async def test_admin_cannot_access_foreign_center_report(client, auth):
    coach2 = await _login(client, "coach2@example.com")
    admin2 = await _login(client, "admin2@example.com")

    report_c2 = await _mk_report(client, coach2, admin2)

    assert (
        await client.get(f"/api/v1/reports/{report_c2}", headers=auth["admin"])
    ).status_code == 403
    assert (
        await client.patch(
            f"/api/v1/reports/{report_c2}", json={"data_json": {}}, headers=auth["admin"],
        )
    ).status_code == 403
    assert (
        await client.delete(f"/api/v1/reports/{report_c2}", headers=auth["admin"])
    ).status_code == 403
    assert (
        await client.post(
            f"/api/v1/reports/{report_c2}/submit", json={}, headers=auth["admin"],
        )
    ).status_code == 403
    assert (
        await client.post(
            f"/api/v1/reports/{report_c2}/approve", json={"comment": "x"}, headers=auth["admin"],
        )
    ).status_code == 403
    assert (
        await client.post(
            f"/api/v1/reports/{report_c2}/reject", json={"comment": "x"}, headers=auth["admin"],
        )
    ).status_code == 403


async def test_admin_reviews_report_of_own_center(client, auth):
    report_c1 = await _mk_report(client, auth["coach"], auth["admin"])
    await client.post(f"/api/v1/reports/{report_c1}/submit", json={}, headers=auth["coach"])
    resp = await client.post(
        f"/api/v1/reports/{report_c1}/approve", json={"comment": "ok"}, headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


async def test_director_sees_all_centers(client, auth):
    admin2 = await _login(client, "admin2@example.com")
    coach2 = await _login(client, "coach2@example.com")

    report_c1 = await _mk_report(client, auth["coach"], auth["admin"])
    report_c2 = await _mk_report(client, coach2, admin2)

    data = (await client.get("/api/v1/reports", headers=auth["director"])).json()[0]
    ids = {r["id"] for r in data}
    assert report_c1 in ids and report_c2 in ids

    # Опциональный фильтр по центру у директора работает.
    filtered = (await client.get(
        f"/api/v1/reports?center_id={CENTER2_ID}", headers=auth["director"],
    )).json()[0]
    fids = {r["id"] for r in filtered}
    assert report_c2 in fids and report_c1 not in fids


async def test_director_can_review_any_center(client, auth):
    admin2 = await _login(client, "admin2@example.com")
    coach2 = await _login(client, "coach2@example.com")

    report_c2 = await _mk_report(client, coach2, admin2)
    await client.post(f"/api/v1/reports/{report_c2}/submit", json={}, headers=coach2)
    resp = await client.post(
        f"/api/v1/reports/{report_c2}/approve", json={"comment": "ok"}, headers=auth["director"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


async def test_superadmin_sees_all_centers(client, auth):
    admin2 = await _login(client, "admin2@example.com")
    coach2 = await _login(client, "coach2@example.com")

    report_c1 = await _mk_report(client, auth["coach"], auth["admin"])
    report_c2 = await _mk_report(client, coach2, admin2)

    data = (await client.get("/api/v1/reports", headers=auth["superadmin"])).json()[0]
    ids = {r["id"] for r in data}
    assert report_c1 in ids and report_c2 in ids


async def test_coach_of_other_center_keeps_own_scope(client, auth):
    coach2 = await _login(client, "coach2@example.com")

    report_c1 = await _mk_report(client, auth["coach"], auth["admin"])
    report_c2 = await _mk_report(client, coach2, auth["admin"])

    assert (
        await client.get(f"/api/v1/reports/{report_c1}", headers=coach2)
    ).status_code == 403

    data = (await client.get("/api/v1/reports", headers=coach2)).json()[0]
    ids = {r["id"] for r in data}
    assert report_c2 in ids
    assert report_c1 not in ids
