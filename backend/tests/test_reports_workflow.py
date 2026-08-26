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
