from datetime import date
from typing import Optional

from pydantic import BaseModel, model_validator


class CoachVacationCreate(BaseModel):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self) -> "CoachVacationCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be >= start_date")
        return self


class CoachVacationResponse(BaseModel):
    id: str
    start_date: date
    end_date: date


class CoachSickLeaveCreate(BaseModel):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self) -> "CoachSickLeaveCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be >= start_date")
        return self


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


def _check_overlaps(periods: list[CoachVacationCreate] | list[CoachSickLeaveCreate] | None, label: str) -> None:
    if not periods:
        return
    for i, a in enumerate(periods):
        for j, b in enumerate(periods):
            if i >= j:
                continue
            if a.start_date <= b.end_date and b.start_date <= a.end_date:
                raise ValueError(f"Пересечение {label}: период {i+1} ({a.start_date}–{a.end_date}) и период {j+1} ({b.start_date}–{b.end_date})")


def _check_cross_overlaps(vacations: list[CoachVacationCreate] | None, sick_leaves: list[CoachSickLeaveCreate] | None) -> None:
    if not vacations or not sick_leaves:
        return
    for v in vacations:
        for s in sick_leaves:
            if v.start_date <= s.end_date and s.start_date <= v.end_date:
                raise ValueError(f"Пересечение отпуска ({v.start_date}–{v.end_date}) и больничного ({s.start_date}–{s.end_date})")


class CoachUpdate(BaseModel):
    specialization: str | None = None
    qualification: str | None = None
    biography: str | None = None
    is_active: bool | None = None
    vacations: list[CoachVacationCreate] | None = None
    sick_leaves: list[CoachSickLeaveCreate] | None = None

    @model_validator(mode="after")
    def validate_periods(self) -> "CoachUpdate":
        if self.vacations is not None:
            _check_overlaps(self.vacations, "отпусков")
        if self.sick_leaves is not None:
            _check_overlaps(self.sick_leaves, "больничных")
        _check_cross_overlaps(self.vacations, self.sick_leaves)
        return self


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
