import datetime
from datetime import time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TrainingCreate(BaseModel):
    date: datetime.date
    start_time: time
    location: str = Field(min_length=1, max_length=500)
    center_id: str | None = None


class TrainingUpdate(BaseModel):
    date: "datetime.date | None" = None
    start_time: time | None = None
    location: str | None = Field(default=None, min_length=1, max_length=500)


class TrainingSelect(BaseModel):
    goal: str = Field(min_length=1, max_length=2000)


class TrainingAttendance(BaseModel):
    participants_count: int = Field(ge=1, le=30)


class TrainingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    center_name: str = ""
    coach_id: str | None = None
    coach_name: str = ""
    coach_user_id: str | None = None
    date: "datetime.date"
    start_time: time
    location: str
    participants_count: int | None = None
    goal: str | None = None
    status: Literal["proposed", "confirmed", "cancelled"]
    plan_item_id: str | None = None
    created_by: str
    created_at: datetime.datetime
    updated_at: "datetime.datetime | None" = None