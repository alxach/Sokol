from datetime import date

from pydantic import BaseModel


class ReportTemplateCreate(BaseModel):
    name: str
    code: str
    report_type: str
    structure_json: dict
    description: str | None = None


class ReportCreate(BaseModel):
    template_id: str
    center_id: str | None = None
    coach_id: str | None = None
    program_id: str | None = None
    payout_tier: int | None = None
    commission_protocol_id: str | None = None
    period_type: str
    period_start: date
    period_end: date
    data_json: dict


class ReportActionRequest(BaseModel):
    comment: str | None = None


class ReportResponse(BaseModel):
    id: str
    template_id: str
    author_id: str
    center_id: str | None
    coach_id: str | None
    period_type: str
    period_start: date
    period_end: date
    data_json: dict
    status: str
    reviewer_id: str | None
    review_comment: str | None
