from datetime import date

from pydantic import BaseModel


class CoachCreate(BaseModel):
    user_id: str
    center_id: str | None = None
    specialization: str
    qualification: str | None = None
    biography: str | None = None
    hire_date: date


class CoachUpdate(BaseModel):
    specialization: str | None = None
    qualification: str | None = None
    biography: str | None = None
    is_active: bool | None = None


class CoachResponse(BaseModel):
    id: str
    user_id: str
    center_id: str | None
    specialization: str
    qualification: str | None
    hire_date: date
    is_active: bool
