from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class IncentiveProgramCreate(BaseModel):
    name: str
    regulation_number: str
    regulation_date: date
    revision: int
    max_payout: int = 50000
    min_payout: int = 25000
    ndfl_rate: float = 13.00
    insurance_rate: float = 30.20
    is_discretionary: bool = True
    status: str = "active"


class IncentiveProgramResponse(BaseModel):
    id: str
    name: str
    regulation_number: str
    regulation_date: date
    revision: int
    max_payout: int
    min_payout: int
    ndfl_rate: float
    insurance_rate: float
    is_discretionary: bool
    status: str


class CommissionProtocolCreate(BaseModel):
    number: str
    date: date
    beneficiary_name: str
    period: str
    center_id: str
    agenda: str | None = None
    decisions: str | None = None
    voting_for: int = 0
    voting_against: int = 0
    voting_abstained: int = 0


class PayoutRowCreate(BaseModel):
    coach_id: str
    report_id: str | None = None
    sport_type: str
    period_start: date
    period_end: date
    gross_amount: Decimal
    # Calculated server-side from gross_amount (Приложение №6); client values ignored
    ndfl_amount: Decimal | None = None
    insurance_amount: Decimal | None = None
    net_amount: Decimal | None = None


class CommissionProtocolResponse(BaseModel):
    id: str
    number: str
    date: date
    beneficiary_name: str
    period: str
    center_id: str
    agenda: str | None
    decisions: str | None
    voting_for: int
    voting_against: int
    voting_abstained: int


class PayoutRowResponse(BaseModel):
    id: str
    protocol_id: str
    coach_id: str
    report_id: str | None
    sport_type: str
    period_start: date
    period_end: date
    gross_amount: Decimal
    ndfl_amount: Decimal
    insurance_amount: Decimal
    net_amount: Decimal


class EventPlanCreate(BaseModel):
    coach_id: str
    center_id: str
    program_id: str | None = None
    year: int


class PlanItemCreate(BaseModel):
    category: str
    quarter: int
    month: int
    date: str
    name: str
    description: str | None = None
    location: str | None = None
    participants_category: str | None = None
    participants_count: str | None = None


class EventPlanResponse(BaseModel):
    id: str
    coach_id: str
    center_id: str
    program_id: str | None
    year: int
    status: str
    reviewer_id: str | None
    review_comment: str | None


class PlanItemResponse(BaseModel):
    id: str
    plan_id: str
    category: str
    quarter: int
    month: int
    date: str
    name: str
    description: str | None
    location: str | None
    participants_category: str | None
    participants_count: str | None
    status: str
    reviewer_comment: str | None
