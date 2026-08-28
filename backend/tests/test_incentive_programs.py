import uuid

from tests.conftest import CENTER_ID, COACH_ID


async def test_program_create_list_update(client, auth):
    sa = auth["superadmin"]
    reg_number = f"ЦСиЗ-26-{uuid.uuid4().hex[:6].upper()}"

    resp = await client.post(
        "/api/v1/incentive/programs", headers=sa,
        json={
            "name": "Программа тест",
            "regulation_number": reg_number,
            "regulation_date": "2026-01-01",
            "revision": 1,
            "max_payout": 50000,
            "min_payout": 25000,
            "ndfl_rate": 13.0,
            "insurance_rate": 30.2,
            "status": "draft",
        },
    )
    assert resp.status_code == 200, resp.text
    program_id = resp.json()["id"]

    resp = await client.post(
        "/api/v1/incentive/programs", headers=sa,
        json={
            "name": "Дубль",
            "regulation_number": reg_number,
            "regulation_date": "2026-01-01",
            "revision": 1,
        },
    )
    assert resp.status_code == 409, resp.text

    resp = await client.patch(
        f"/api/v1/incentive/programs/{program_id}", headers=sa,
        json={"min_payout": 30000, "max_payout": 60000, "status": "active",
              "ndfl_rate": 13.0, "insurance_rate": 30.2},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["min_payout"] == 30000
    assert resp.json()["max_payout"] == 60000
    assert resp.json()["status"] == "active"

    resp = await client.get("/api/v1/incentive/programs", headers=sa)
    assert resp.status_code == 200, resp.text
    assert any(p["id"] == program_id and p["status"] == "active" for p in resp.json())

    resp = await client.patch(
        f"/api/v1/incentive/programs/{'00000000-0000-0000-0000-000000000000'}",
        headers=sa, json={"name": "x"},
    )
    assert resp.status_code == 404, resp.text


async def test_program_payout_respects_updated_tier(client, auth):
    """Payout uses active program's current min/max and rates."""
    sa = auth["superadmin"]
    reg_number = f"ЦСиЗ-26-{uuid.uuid4().hex[:6].upper()}"
    await client.post(
        "/api/v1/incentive/programs", headers=sa,
        json={
            "name": "Программа +тир",
            "regulation_number": reg_number,
            "regulation_date": "2026-01-01",
            "revision": 1,
            "max_payout": 90000,
            "min_payout": 10000,
            "ndfl_rate": 13.0,
            "insurance_rate": 30.2,
            "status": "active",
        },
    )

    protocol_id = (await client.post(
        "/api/v1/incentive/protocols", headers=sa,
        json={
            "number": f"П-{uuid.uuid4().hex[:6]}",
            "date": "2026-08-27",
            "beneficiary_name": "Иванов И.И.",
            "period": "8-2026",
            "center_id": CENTER_ID,
        },
    )).json()["id"]

    resp = await client.post(
        f"/api/v1/incentive/protocols/{protocol_id}/payouts", headers=sa,
        json={
            "coach_id": COACH_ID,
            "sport_type": "Дзюдо",
            "period_start": "2026-08-01",
            "period_end": "2026-08-31",
            "gross_amount": "60000.00",
        },
    )
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["gross_amount"]) == 60000.00
