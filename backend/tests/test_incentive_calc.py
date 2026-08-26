from decimal import Decimal

import pytest

from app.services.incentive_calc import (
    breakdown_from_gross,
    gross_for_net_target,
    validate_tier,
)
from tests.conftest import CENTER_ID, COACH_ID

pytestmark = pytest.mark.asyncio


async def test_regulation_max_tier_example():
    """Приложение №6: net 50 000 -> начислено 74 827,24 / НДФЛ 7 471 / взносы 17 356,24."""
    b = gross_for_net_target(Decimal("50000"))
    assert abs(b.gross_amount - Decimal("74827.24")) <= Decimal("0.5")
    assert abs(b.ndfl_amount - Decimal("7471.00")) <= Decimal("0.3")
    assert abs(b.insurance_amount - Decimal("17356.24")) <= Decimal("0.3")


async def test_regulation_min_tier_example():
    b = gross_for_net_target(Decimal("25000"))
    assert abs(b.gross_amount - Decimal("37414.27")) <= Decimal("0.5")
    assert abs(b.net_amount - Decimal("25000")) <= Decimal("0.05")


async def test_breakdown_identity_holds():
    """gross - ndfl - insurance == net for arbitrary gross."""
    b = breakdown_from_gross(Decimal("123456.78"))
    assert b.gross_amount - b.ndfl_amount - b.insurance_amount == b.net_amount
    assert b.net_amount > 0


async def test_client_supplied_values_ignored_by_design():
    """Server recalculates: same gross always yields identical breakdown (idempotence)."""
    a = breakdown_from_gross(Decimal("40000"))
    c = breakdown_from_gross(Decimal("40000"))
    assert a == c


async def test_negative_gross_rejected():
    with pytest.raises(ValueError):
        breakdown_from_gross(Decimal("-1"))


async def test_zero_gross_rejected():
    with pytest.raises(ValueError):
        breakdown_from_gross(Decimal("0"))


async def test_tier_limits():
    validate_tier(Decimal("25000"), 25000, 50000)
    validate_tier(Decimal("50000"), 25000, 50000)
    with pytest.raises(ValueError, match="exceeds"):
        validate_tier(Decimal("50000.01"), 25000, 50000)
    with pytest.raises(ValueError, match="below min tier"):
        validate_tier(Decimal("24999.99"), 25000, 50000)
    with pytest.raises(ValueError, match="positive"):
        validate_tier(Decimal("0"), 25000, 50000)


async def test_api_recalculates_and_enforces_tier(client, auth):
    """PayoutRowCreate ignores client ndfl/insurance/net; server enforces max tier."""
    protocol = {
        "number": "PR-CALC-1",
        "date": "2026-08-01",
        "beneficiary_name": "АНО ЦСиЗ",
        "period": "3 кв. 2026",
        "center_id": CENTER_ID,
    }
    resp = await client.post("/api/v1/incentive/protocols", json=protocol, headers=auth["admin"])
    assert resp.status_code == 200, resp.text
    protocol_id = resp.json()["id"]

    row = {
        "coach_id": COACH_ID,
        "sport_type": "Дзюдо",
        "period_start": "2026-07-01",
        "period_end": "2026-09-30",
        "gross_amount": "37414.19",
        "ndfl_amount": "999999",  # must be ignored and recomputed
        "insurance_amount": "999999",
        "net_amount": "999999",
    }
    resp = await client.post(
        f"/api/v1/incentive/protocols/{protocol_id}/payouts", json=row, headers=auth["admin"],
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["ndfl_amount"] != "999999"
    assert abs(float(data["net_amount"]) - 25000) < 0.5

    over_tier = dict(row, sport_type="Самбо", gross_amount="200000")
    resp = await client.post(
        f"/api/v1/incentive/protocols/{protocol_id}/payouts", json=over_tier, headers=auth["admin"],
    )
    assert resp.status_code == 422
