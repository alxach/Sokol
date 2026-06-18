from datetime import date

from pydantic import BaseModel


class CoachVacationCreate(BaseModel):
    start_date: date
    end_date: date


class CoachVacationResponse(BaseModel):
    id: str
    start_date: date
    end_date: date


class CoachSickLeaveCreate(BaseModel):
    start_date: date
    end_date: date


class CoachSickLeaveResponse(BaseModel):
    id: str
    start_date: date
    end_date: date


class CoachCreate(BaseModel):
    user_id: str
    center_id: str | None = None
    specialization: str
    qualification: str | None = None
    biography: str | None = None
    hire_date: date
    vacations: list[CoachVacationCreate] = []
    sick_leaves: list[CoachSickLeaveCreate] = []


class CoachUpdate(BaseModel):
    specialization: str | None = None
    qualification: str | None = None
    biography: str | None = None
    is_active: bool | None = None
    vacations: list[CoachVacationCreate] | None = None
    sick_leaves: list[CoachSickLeaveCreate] | None = None


class CoachResponse(BaseModel):
    id: str
    user_id: str
    center_id: str | None
    specialization: str
    qualification: str | None
    hire_date: date
    is_active: bool
    vacations: list[CoachVacationResponse] = []
    sick_leaves: list[CoachSickLeaveResponse] = []
