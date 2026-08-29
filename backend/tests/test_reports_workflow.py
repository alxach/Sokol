import uuid

import pytest

pytestmark = pytest.mark.asyncio


async def _make_report(client, auth) -> str:
    tpl = {
        "name": "Квартальный",
        "code": f"quarterly-{uuid.uuid4().hex[:8]}",
        "report_type": "quarterly",
        "structure_json": {"fields": []},
    }
    resp = await client.post("/api/v1/reports/templates", json=tpl, headers=auth["admin"])
    assert resp.status_code == 200, resp.text
    template_id = resp.json()["id"]

    report = {
        "template_id": template_id,
        "period_type": "quarterly",
        "period_start": "2026-07-01",
        "period_end": "2026-09-30",
        "data_json": {"athletes_count": 12},
    }
    resp = await client.post("/api/v1/reports", json=report, headers=auth["coach"])
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


async def test_full_lifecycle(client, auth):
    report_id = await _make_report(client, auth)

    resp = await client.get("/api/v1/reports", headers=auth["admin"])
    assert resp.status_code == 200
    created = [r for r in resp.json()[0] if r["id"] == report_id]
    assert created and created[0]["status"] == "draft"

    resp = await client.post(
        f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"

    resp = await client.post(
        f"/api/v1/reports/{report_id}/approve", json={"comment": "ok"}, headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


async def test_invalid_transition_rejected(client, auth):
    report_id = await _make_report(client, auth)
    resp = await client.post(
        f"/api/v1/reports/{report_id}/approve", json={"comment": "skip"}, headers=auth["admin"],
    )
    assert resp.status_code == 422


async def test_reject_requires_comment(client, auth):
    report_id = await _make_report(client, auth)
    await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])
    resp = await client.post(
        f"/api/v1/reports/{report_id}/reject", json={"comment": None}, headers=auth["admin"],
    )
    assert resp.status_code == 422

    resp = await client.post(
        f"/api/v1/reports/{report_id}/reject",
        json={"comment": "недостаточно данных"},
        headers=auth["director"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


async def test_resubmit_after_reject(client, auth):
    report_id = await _make_report(client, auth)
    await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])
    await client.post(
        f"/api/v1/reports/{report_id}/reject", json={"comment": "fix"}, headers=auth["admin"],
    )
    resp = await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"


async def test_coach_cannot_approve(client, auth):
    report_id = await _make_report(client, auth)
    await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])
    resp = await client.post(
        f"/api/v1/reports/{report_id}/approve", json={"comment": "self"}, headers=auth["coach"],
    )
    assert resp.status_code == 403


async def test_anonymous_cannot_submit(client):
    resp = await client.post(
        "/api/v1/reports/00000000-0000-0000-0000-000000000009/submit", json={},
    )
    assert resp.status_code == 401


async def _make_number_template(client, auth_y) -> str:
    tpl = {
        "name": "Числовая",
        "code": f"numeric-{uuid.uuid4().hex[:8]}",
        "report_type": "monthly",
        "structure_json": {
            "fields": [
                {"key": "athletes_count", "type": "number", "normFull": 30, "normBasic": 15},
                {"key": "hours_per_week", "type": "number", "normFull": 9, "normBasic": 4.5},
            ],
        },
    }
    resp = await client.post("/api/v1/reports/templates", json=tpl, headers=auth_y["admin"])
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


async def test_get_update_delete_draft(client, auth):
    report_id = await _make_report(client, auth)

    resp = await client.get(f"/api/v1/reports/{report_id}", headers=auth["coach"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == report_id
    assert resp.json()["status"] == "draft"

    resp = await client.patch(
        f"/api/v1/reports/{report_id}",
        json={"data_json": {"athletes_count": 25}},
        headers=auth["coach"],
    )
    assert resp.status_code == 200
    assert resp.json()["data_json"]["athletes_count"] == 25

    resp = await client.delete(f"/api/v1/reports/{report_id}", headers=auth["coach"])
    assert resp.status_code == 200

    resp = await client.get(f"/api/v1/reports/{report_id}", headers=auth["coach"])
    assert resp.status_code == 404


async def test_cannot_edit_submitted(client, auth):
    report_id = await _make_report(client, auth)
    await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])

    resp = await client.patch(
        f"/api/v1/reports/{report_id}", json={"data_json": {"x": 1}}, headers=auth["coach"],
    )
    assert resp.status_code == 422

    resp = await client.delete(f"/api/v1/reports/{report_id}", headers=auth["coach"])
    assert resp.status_code == 422


async def test_coach_cannot_touch_foreign_report(client, auth):
    tpl = {
        "name": "Чужой",
        "code": f"foreign-{uuid.uuid4().hex[:8]}",
        "report_type": "monthly",
        "structure_json": {"fields": []},
    }
    resp = await client.post("/api/v1/reports/templates", json=tpl, headers=auth["admin"])
    template_id = resp.json()["id"]
    report = {
        "template_id": template_id,
        "period_type": "monthly",
        "period_start": "2026-08-01",
        "period_end": "2026-08-31",
        "data_json": {},
    }
    resp = await client.post("/api/v1/reports", json=report, headers=auth["admin"])
    foreign_id = resp.json()["id"]

    assert (
        await client.get(f"/api/v1/reports/{foreign_id}", headers=auth["coach"])
    ).status_code == 403
    assert (
        await client.patch(
            f"/api/v1/reports/{foreign_id}", json={"data_json": {}}, headers=auth["coach"],
        )
    ).status_code == 403
    assert (
        await client.delete(f"/api/v1/reports/{foreign_id}", headers=auth["coach"])
    ).status_code == 403

    resp = await client.get("/api/v1/reports", headers=auth["coach"])
    assert resp.status_code == 200
    assert all(r["id"] != foreign_id for r in resp.json()[0])

    admin_rows = [r for r in (await client.get("/api/v1/reports", headers=auth["admin"])).json()[0]
                  if r["id"] == foreign_id]
    assert admin_rows and admin_rows[0]["status"] == "draft"


async def test_submit_computes_payout_tier(client, auth):
    template_id = await _make_number_template(client, auth)

    report = {
        "template_id": template_id,
        "period_type": "monthly",
        "period_start": "2026-08-01",
        "period_end": "2026-08-31",
        "data_json": {"athletes_count": 32, "hours_per_week": 10},
    }
    resp = await client.post("/api/v1/reports", json=report, headers=auth["coach"])
    full_id = resp.json()["id"]
    resp = await client.post(f"/api/v1/reports/{full_id}/submit", json={}, headers=auth["coach"])
    assert resp.status_code == 200
    assert resp.json()["payout_tier"] == 50000

    basic = {
        "template_id": template_id,
        "period_type": "monthly",
        "period_start": "2026-08-01",
        "period_end": "2026-08-31",
        "data_json": {"athletes_count": 20, "hours_per_week": 5},
    }
    resp = await client.post("/api/v1/reports", json=basic, headers=auth["coach"])
    basic_id = resp.json()["id"]
    resp = await client.post(f"/api/v1/reports/{basic_id}/submit", json={}, headers=auth["coach"])
    assert resp.status_code == 200
    assert resp.json()["payout_tier"] == 25000

    low = {
        "template_id": template_id,
        "period_type": "monthly",
        "period_start": "2026-08-01",
        "period_end": "2026-08-31",
        "data_json": {"athletes_count": 5, "hours_per_week": 2},
    }
    resp = await client.post("/api/v1/reports", json=low, headers=auth["coach"])
    low_id = resp.json()["id"]
    resp = await client.post(f"/api/v1/reports/{low_id}/submit", json={}, headers=auth["coach"])
    assert resp.status_code == 200
    assert resp.json()["payout_tier"] == 0
