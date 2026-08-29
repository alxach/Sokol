from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReportTemplateCreate(BaseModel):
    name: str
    code: str
    report_type: str
    structure_json: dict
    description: str | None = None


class ReportCreate(BaseModel):
    template_id: UUID
    center_id: UUID | None = None
    coach_id: UUID | None = None
    program_id: UUID | None = None
    payout_tier: int | None = None
    commission_protocol_id: UUID | None = None
    period_type: str
    period_start: date
    period_end: date
    data_json: dict


class ReportUpdate(BaseModel):
    period_type: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    data_json: dict | None = None


class ReportActionRequest(BaseModel):
    comment: str | None = None


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    template_id: UUID
    author_id: UUID
    center_id: UUID | None = None
    coach_id: UUID | None = None
    program_id: UUID | None = None
    payout_tier: int | None = None
    commission_protocol_id: UUID | None = None
    period_type: str
    period_start: date
    period_end: date
    data_json: dict
    status: str
    reviewer_id: UUID | None = None
    review_comment: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    template_name: str | None = None
    coach_name: str | None = None
    coach_user_id: str | None = None
    author_name: str | None = None
    center_name: str | None = None
    center_city: str | None = None
    sport: str | None = None
