import uuid

import pytest
from sqlalchemy import text

from tests.conftest import COACH_ID

pytestmark = pytest.mark.asyncio


async def _login(client, email) -> dict:
    from tests.conftest import PASSWORD

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


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
    auth2 = await _login(client, "coach2@example.com")
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
    resp = await client.post("/api/v1/reports", json=report, headers=auth2)
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

    # Отчёт тренера из другого центра не виден руководителю своего центра.
    admin_rows = [r for r in (await client.get("/api/v1/reports", headers=auth["admin"])).json()[0]
                  if r["id"] == foreign_id]
    assert not admin_rows
    assert (
        await client.get(f"/api/v1/reports/{foreign_id}", headers=auth["admin"])
    ).status_code == 403


async def test_submit_computes_payout_tier(client, auth, session_maker):
    template_id = await _make_number_template(client, auth)

    programs = (await client.get("/api/v1/incentive/programs", headers=auth["admin"])).json()
    active = [p for p in programs if p["status"] == "active"]
    max_payout = active[0]["max_payout"] if active else 50000
    min_payout = active[0]["min_payout"] if active else 25000

    async def _reset_tier():
        async with session_maker() as session:
            await session.execute(
                text("UPDATE coaches SET incentive_tier = NULL WHERE id = :id"),
                {"id": COACH_ID},
            )
            await session.commit()

    async def _submit(data: dict) -> int:
        resp = await client.post(
            "/api/v1/reports",
            json={
                "template_id": template_id,
                "period_type": "monthly",
                "period_start": "2026-08-01",
                "period_end": "2026-08-31",
                "data_json": data,
            },
            headers=auth["coach"],
        )
        report_id = resp.json()["id"]
        resp = await client.post(
            f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"],
        )
        assert resp.status_code == 200, resp.text
        return resp.json()["payout_tier"]

    async def _set_tier(tier: str):
        resp = await client.put(
            f"/api/v1/incentive/coach-tiers/{COACH_ID}",
            json={"tier": tier},
            headers=auth["admin"],
        )
        assert resp.status_code == 200, resp.text

    # Тир не назначен → выплата 0 независимо от показателей.
    await _reset_tier()
    assert await _submit({"athletes_count": 32, "hours_per_week": 10}) == 0

    # Полный тир: достижение полной нормы → max, иначе 0.
    await _set_tier("full")
    assert await _submit({"athletes_count": 32, "hours_per_week": 10}) == max_payout
    assert await _submit({"athletes_count": 20, "hours_per_week": 5}) == 0

    # Базовый тир: достижение базовой нормы → min (даже при превышении), иначе 0.
    await _set_tier("basic")
    assert await _submit({"athletes_count": 20, "hours_per_week": 5}) == min_payout
    assert await _submit({"athletes_count": 32, "hours_per_week": 10}) == min_payout
    assert await _submit({"athletes_count": 5, "hours_per_week": 2}) == 0


async def test_rejected_report_redraft_full_cycle(client, auth):
    report_id = await _make_report(client, auth)
    await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])
    resp = await client.post(
        f"/api/v1/reports/{report_id}/reject",
        json={"comment": "исправьте данные"},
        headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    resp = await client.post(f"/api/v1/reports/{report_id}/redraft", headers=auth["coach"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "draft"
    assert resp.json()["review_comment"] is None
    assert resp.json()["payout_tier"] is None

    resp = await client.patch(
        f"/api/v1/reports/{report_id}",
        json={"data_json": {"athletes_count": 40}},
        headers=auth["coach"],
    )
    assert resp.status_code == 200
    assert resp.json()["data_json"]["athletes_count"] == 40

    resp = await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"

    resp = await client.post(
        f"/api/v1/reports/{report_id}/approve", json={"comment": "ok"}, headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


async def test_redraft_forbidden_for_non_author(client, auth):
    resp = await client.get("/api/v1/reports", headers=auth["admin"])
    report_id = resp.json()[0][0]["id"]

    coach2 = await _login(client, "coach2@example.com")
    resp = await client.post(f"/api/v1/reports/{report_id}/redraft", headers=coach2)
    assert resp.status_code == 403


async def test_redraft_only_for_rejected(client, auth):
    report_id = await _make_report(client, auth)

    resp = await client.post(f"/api/v1/reports/{report_id}/redraft", headers=auth["coach"])
    assert resp.status_code == 422, resp.text

    await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=auth["coach"])
    resp = await client.post(f"/api/v1/reports/{report_id}/redraft", headers=auth["coach"])
    assert resp.status_code == 422

    await client.post(
        f"/api/v1/reports/{report_id}/approve", json={"comment": "ok"}, headers=auth["admin"],
    )
    resp = await client.post(f"/api/v1/reports/{report_id}/redraft", headers=auth["coach"])
    assert resp.status_code == 422
