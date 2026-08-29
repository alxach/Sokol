from datetime import date, time

from pydantic import BaseModel, ConfigDict


class ScheduleCreate(BaseModel):
    group_id: str
    center_id: str | None = None
    coach_id: str | None = None
    day_of_week: int
    start_time: time
    end_time: time
    location: str | None = None
    room: str | None = None


class ScheduleResponse(BaseModel):
    id: str
    group_id: str | None
    day_of_week: int
    start_time: str
    end_time: str
    location: str | None
    room: str | None


class ScheduleCalendarParams(BaseModel):
    date_from: date
    date_to: date
    group_id: str | None = None


class CoachAbsenceResponse(BaseModel):
    type: str
    start_date: date
    end_date: date


class SchedulePeriodCreate(BaseModel):
    group_id: str
    period_start: date
    period_end: date


class SchedulePeriodUpdate(BaseModel):
    period_start: date | None = None
    period_end: date | None = None


class SchedulePeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    group_id: str
    coach_id: str | None = None
    center_id: str | None = None
    group_name: str | None = None
    coach_name: str | None = None
    coach_user_id: str | None = None
    discipline: str | None = None
    period_start: date
    period_end: date
    status: str
    created_at: str | None = None
    lesson_count: int = 0
    absences: list[CoachAbsenceResponse] = []


class ScheduleItemCreate(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time
    room: str | None = None


class ScheduleItemUpdate(BaseModel):
    day_of_week: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None


class ScheduleItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    day_of_week: int
    start_time: str
    end_time: str
    room: str | None = None
    location: str | None = None


class SchedulePeriodDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period: SchedulePeriodResponse
    items: list[ScheduleItemResponse] = []
