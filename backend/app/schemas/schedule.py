from datetime import date, time

from pydantic import BaseModel


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
