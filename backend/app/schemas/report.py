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
    period_type: str
    period_start: date
    period_end: date
    data_json: dict
