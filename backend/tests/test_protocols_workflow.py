import uuid

import pytest

from tests.conftest import CENTER_ID

pytestmark = pytest.mark.asyncio


async def _make_protocol(client, auth, **overrides) -> str:
    body = {
        "number": "ПСМС-2026-001",
        "date": "2026-08-20",
        "beneficiary_name": "АНО «Центр Спорта и Здоровья»",
        "period": "2026-08",
        "center_id": CENTER_ID,
        "agenda": "Утверждение выплат",
        "decisions": "Одобрить",
        "voting_for": 5,
        "voting_against": 0,
        "voting_abstained": 0,
        **overrides,
    }
    resp = await client.post("/api/v1/incentive/protocols", json=body, headers=auth["admin"])
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _add_payout(client, auth, protocol_id: str, gross: str = "74827.24", **overrides) -> dict:
    from tests.conftest import COACH_ID

    body = {
        "coach_id": COACH_ID,
        "sport_type": "Дзюдо",
        "period_start": "2026-08-01",
        "period_end": "2026-08-31",
        "gross_amount": gross,
        **overrides,
    }
    resp = await client.post(
        f"/api/v1/incentive/protocols/{protocol_id}/payouts",
        json=body,
        headers=auth["admin"],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_protocol_lifecycle_with_review(client, auth):
    created = await _make_protocol(client, auth)
    protocol_id = created["id"]

    assert created["status"] == "draft"
    assert created["center_name"] == "ЦСЕ Тест"
    assert created["payout_rows"] == []

    resp = await client.get("/api/v1/incentive/protocols", headers=auth["admin"])
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()}
    assert protocol_id in ids

    row = await _add_payout(client, auth, protocol_id)
    assert row["coach_name"] == "Test coach"
    assert row["net_amount"] == "49999.77"
    assert row["ndfl_amount"] == "7471.23"

    resp = await client.get(
        f"/api/v1/incentive/protocols/{protocol_id}/payouts", headers=auth["admin"],
    )
    assert resp.status_code == 200
    rows = resp.json()
    assert any(r["id"] == row["id"] for r in rows)

    resp = await client.patch(
        f"/api/v1/incentive/protocols/{protocol_id}",
        json={"decisions": "Одобрить (ред.)"},
        headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json()["decisions"] == "Одобрить (ред.)"

    resp = await client.post(
        f"/api/v1/incentive/protocols/{protocol_id}/approve",
        json={},
        headers=auth["admin"],
    )
    assert resp.status_code == 200
    approved = resp.json()
    assert approved["status"] == "approved"
    assert approved["reviewer_id"]
    assert approved["reviewed_at"]

    resp = await client.patch(
        f"/api/v1/incentive/protocols/{protocol_id}",
        json={"decisions": "X"},
        headers=auth["admin"],
    )
    assert resp.status_code == 422

    resp = await client.delete(
        f"/api/v1/incentive/protocols/{protocol_id}", headers=auth["admin"],
    )
    assert resp.status_code == 422


async def test_protocol_draft_can_be_deleted_with_rows(client, auth):
    created = await _make_protocol(
        client, auth, number=f"ПСМС-2026-{uuid.uuid4().hex[:6]}",
    )
    protocol_id = created["id"]
    await _add_payout(client, auth, protocol_id)

    resp = await client.delete(
        f"/api/v1/incentive/protocols/{protocol_id}", headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    resp = await client.get(
        f"/api/v1/incentive/protocols/{protocol_id}", headers=auth["admin"],
    )
    assert resp.status_code == 404


async def test_protocol_reject_requires_comment(client, auth):
    created = await _make_protocol(client, auth, number=f"ПСМС-2026-{uuid.uuid4().hex[:6]}")
    protocol_id = created["id"]

    resp = await client.post(
        f"/api/v1/incentive/protocols/{protocol_id}/reject",
        json={"comment": ""},
        headers=auth["admin"],
    )
    assert resp.status_code == 422

    resp = await client.post(
        f"/api/v1/incentive/protocols/{protocol_id}/reject",
        json={"comment": "Документы неполные"},
        headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    assert resp.json()["review_comment"] == "Документы неполные"


async def test_payout_row_delete_and_draft_only(client, auth):
    created = await _make_protocol(client, auth, number=f"ПСМС-2026-{uuid.uuid4().hex[:6]}")
    protocol_id = created["id"]
    row = await _add_payout(client, auth, protocol_id)

    resp = await client.delete(
        f"/api/v1/incentive/protocols/{protocol_id}/payouts/{row['id']}",
        headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    resp = await client.get(
        f"/api/v1/incentive/protocols/{protocol_id}/payouts", headers=auth["admin"],
    )
    assert resp.status_code == 200
    assert resp.json() == []

    detach = await _make_protocol(client, auth, number=f"ПСМС-2026-{uuid.uuid4().hex[:6]}")
    phase_id = detach["id"]
    row2 = await _add_payout(client, auth, phase_id)
    resp = await client.post(
        f"/api/v1/incentive/protocols/{phase_id}/approve",
        json={},
        headers=auth["admin"],
    )
    assert resp.status_code == 200
    resp = await client.delete(
        f"/api/v1/incentive/protocols/{phase_id}/payouts/{row2['id']}",
        headers=auth["admin"],
    )
    assert resp.status_code == 422


async def test_payout_added_recalculates_breakdown(client, auth):
    created = await _make_protocol(client, auth, number=f"ПСМС-2026-{uuid.uuid4().hex[:6]}")
    protocol_id = created["id"]

    row = await _add_payout(client, auth, protocol_id, gross="50000.00")
    assert row["net_amount"] == "33410.14"
    assert row["ndfl_amount"] == "4992.32"

    resp = await client.get(f"/api/v1/incentive/protocols/{protocol_id}", headers=auth["admin"])
    assert resp.status_code == 200
    detail = [r for r in resp.json()["payout_rows"] if r["id"] == row["id"]]
    assert detail and detail[0]["gross_amount"] == "50000.00"


async def test_protocol_list_scoped_by_admin_center(client, auth, session_maker):
    from sqlalchemy import text

    from tests.conftest import REGION_ID

    resp = await client.get("/api/v1/incentive/protocols", headers=auth["coach"])
    assert resp.status_code == 403

    second_center_id = "77777777-7777-7777-7777-777777777777"
    async with session_maker() as session:
        await session.execute(
            text("INSERT INTO centers (id, region_id, name, address, center_type, is_active) "
                 "VALUES (:id, :rid, 'ЦСЕ Второй', 'addr2', 'cse', true) "
                 "ON CONFLICT (id) DO NOTHING"),
            {"id": second_center_id, "rid": REGION_ID},
        )
        await session.execute(
            text("UPDATE users SET center_id = :c WHERE email = 'admin@example.com'"),
            {"c": CENTER_ID},
        )
        await session.commit()

    other = {
        "number": "ПСМС-2026-OTHER-1",
        "date": "2026-08-20",
        "beneficiary_name": "Благополучатель",
        "period": "2026-08",
        "center_id": second_center_id,
    }
    resp = await client.post("/api/v1/incentive/protocols", json=other, headers=auth["director"])
    assert resp.status_code == 200, resp.text

    resp = await client.get("/api/v1/incentive/protocols", headers=auth["director"])
    assert resp.status_code == 200
    assert any(p["center_id"] == second_center_id for p in resp.json())

    resp = await client.get("/api/v1/incentive/protocols", headers=auth["admin"])
    assert resp.status_code == 200
    assert all(p["center_id"] == CENTER_ID for p in resp.json())

    async with session_maker() as session:
        await session.execute(
            text("UPDATE users SET center_id = :c WHERE email = 'admin@example.com'"),
            {"c": CENTER_ID},
        )
        await session.commit()


async def test_protocol_get_404(client, auth):
    resp = await client.get(
        f"/api/v1/incentive/protocols/{uuid.uuid4()}", headers=auth["admin"],
    )
    assert resp.status_code == 404
