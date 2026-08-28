import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


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


class IncentiveProgramUpdate(BaseModel):
    name: str | None = None
    regulation_number: str | None = None
    regulation_date: date | None = None
    revision: int | None = None
    max_payout: int | None = None
    min_payout: int | None = None
    ndfl_rate: float | None = None
    insurance_rate: float | None = None
    is_discretionary: bool | None = None
    status: str | None = None


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


CRITERIA_FIELDS = (
    "athletes",
    "hours",
    "social_events",
    "sports_events",
    "development_events",
)


class IncentiveCriteriaUpsert(BaseModel):
    athletes_full: int = 30
    athletes_basic: int = 15
    hours_full: float = 9.0
    hours_basic: float = 4.5
    social_events_full: int = 1
    social_events_basic: int = 1
    sports_events_full: int = 1
    sports_events_basic: int = 1
    development_events_full: int = 1
    development_events_basic: int = 1

    def validate_levels(self) -> None:
        pairs = (
            ("athletes_full", "athletes_basic"),
            ("hours_full", "hours_basic"),
            ("social_events_full", "social_events_basic"),
            ("sports_events_full", "sports_events_basic"),
            ("development_events_full", "development_events_basic"),
        )
        for full, basic in pairs:
            if self.__getattribute__(full) < self.__getattribute__(basic):
                raise ValueError(
                    f"Полный порог должен быть не ниже базового ({full} < {basic})",
                )


class IncentiveCriteriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    center_id: uuid.UUID
    center_name: str = ""
    athletes_full: int
    athletes_basic: int
    hours_full: float
    hours_basic: float
    social_events_full: int
    social_events_basic: int
    sports_events_full: int
    sports_events_basic: int
    development_events_full: int
    development_events_basic: int


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
    coach_id: str | None = None
    center_id: str | None = None
    program_id: str | None = None
    year: int


class EventPlanUpdate(BaseModel):
    coach_id: str | None = None
    center_id: str | None = None
    program_id: str | None = None
    year: int | None = None


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


class PlanItemUpdate(BaseModel):
    category: str | None = None
    quarter: int | None = None
    month: int | None = None
    date: str | None = None
    name: str | None = None
    description: str | None = None
    location: str | None = None
    participants_category: str | None = None
    participants_count: str | None = None


class PlanItemReview(BaseModel):
    comment: str | None = None


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


class PlanItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan_id: uuid.UUID
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
    submitted_at: datetime | None
    reviewed_at: datetime | None
    reviewer_id: uuid.UUID | None


class EventPlanOut(BaseModel):
    id: str
    coach_id: str
    coach_user_id: str | None = None
    coach_name: str = ""
    coach_initials: str = ""
    discipline: str = ""
    center_id: str
    center_name: str = ""
    program_id: str | None
    year: int
    status: str
    review_comment: str | None
    created_at: datetime | None
    items: list[PlanItemOut] = []
