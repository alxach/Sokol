"""Server-authoritative payout calculations per Положение ред. 8, Приложение №6.

Reference example (regulation):
    base 57 471,26 -> gross (начислено) 74 827,24
    НДФЛ 13% от базы -> 7 471,00; взносы 30,2% от базы -> 17 356,24; на руки 50 000,00

Semantics: net = gross - ndfl - insurance where ndfl/insurance derive from the
pre-insurance base: base = gross / (1 + insurance_rate).
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


def _q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass
class PayoutBreakdown:
    gross_amount: Decimal
    ndfl_amount: Decimal
    insurance_amount: Decimal
    net_amount: Decimal


def breakdown_from_gross(
    gross_amount: Decimal,
    ndfl_rate: float = 13.0,
    insurance_rate: float = 30.2,
) -> PayoutBreakdown:
    """Recalculate a payout row from the employer's gross charge.

    Rates are percent values (13.0 == 13%). All results are rounded to kopecks.
    """
    gross = _q(Decimal(str(gross_amount)))
    if gross <= 0:
        raise ValueError("gross_amount must be positive")
    r_ndfl = Decimal(str(ndfl_rate)) / Decimal("100")
    r_ins = Decimal(str(insurance_rate)) / Decimal("100")

    base = gross / (Decimal("1") + r_ins)
    ndfl = _q(base * r_ndfl)
    insurance = _q(base * r_ins)
    net = gross - ndfl - insurance
    return PayoutBreakdown(
        gross_amount=gross, ndfl_amount=ndfl, insurance_amount=insurance, net_amount=net,
    )


def gross_for_net_target(
    net_amount: Decimal,
    ndfl_rate: float = 13.0,
    insurance_rate: float = 30.2,
) -> PayoutBreakdown:
    """Gross required so the coach receives exactly `net_amount` on hand."""
    r_ndfl = Decimal(str(ndfl_rate)) / Decimal("100")
    r_ins = Decimal(str(insurance_rate)) / Decimal("100")
    base = _q(Decimal(str(net_amount)) / (Decimal("1") - r_ndfl))
    gross = _q(base * (Decimal("1") + r_ins))
    return breakdown_from_gross(gross, ndfl_rate, insurance_rate)


def validate_tier(net_amount: Decimal, min_payout: int, max_payout: int) -> None:
    """Net payout must be within program limits (п. 5: макс 50 000 / мин 25 000)."""
    if net_amount <= 0:
        raise ValueError("Payout must be positive")
    if net_amount > Decimal(max_payout):
        raise ValueError(f"Payout {net_amount} exceeds max tier {max_payout} (п. 5 Положения)")
    if net_amount < Decimal(min_payout):
        raise ValueError(f"Payout {net_amount} is below min tier {min_payout} (п. 5 Положения)")
