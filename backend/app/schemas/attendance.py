from datetime import date, time
from uuid import UUID

from pydantic import BaseModel


class AttendanceMark(BaseModel):
    athlete_id: str
    schedule_id: str | None = None
    date: date
    status: str
    absence_reason: str | None = None


class AttendanceBatchRecord(BaseModel):
    athlete_id: str
    schedule_id: str | None = None
    status: str
    absence_reason: str | None = None


class AttendanceBatch(BaseModel):
    group_id: str
    schedule_id: str | None = None
    date: date
    records: list[AttendanceBatchRecord]


class AttendanceUpdate(BaseModel):
    status: str | None = None
    absence_reason: str | None = None


class AttendanceResponse(BaseModel):
    id: str
    athlete_id: UUID
    schedule_id: UUID | None
    group_id: UUID | None
    date: date
    status: str
    check_in_time: time | None
    absence_reason: str | None
    check_in_method: str | None
    checked_by: UUID | None


class AttendanceStats(BaseModel):
    today_rate: float
    today_diff: float
    week_rate: float
    month_rate: float
    absences_total: int
    absences_diff: int


class HeatmapEntry(BaseModel):
    date: date
    rate: float


class QRGenerateRequest(BaseModel):
    schedule_id: str
    valid_date: date
    valid_from: time
    valid_until: time


class QRGenerateResponse(BaseModel):
    qr_code: str
    valid_date: date
    valid_from: time
    valid_until: time


class QRScanRequest(BaseModel):
    qr_code: str
    athlete_id: str


class TodayTraining(BaseModel):
    id: str
    group_name: str
    discipline: str
    coach_name: str
    start_time: time
    end_time: time
    enrolled: int
    present: int
    status: str
