from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GroupCreate(BaseModel):
    name: str
    center_id: UUID | None = None
    coach_id: UUID | None = None
    sport_type: str
    age_group: str | None = None
    skill_level: str | None = None
    max_capacity: int = 30


class GroupUpdate(BaseModel):
    name: str | None = None
    coach_id: UUID | None = None
    center_id: UUID | None = None
    sport_type: str | None = None
    age_group: str | None = None
    skill_level: str | None = None
    max_capacity: int | None = None
    schedule_note: str | None = None
    is_active: bool | None = None


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    center_id: UUID | None
    coach_id: UUID | None
    sport_type: str
    age_group: str | None
    skill_level: str | None
    max_capacity: int
    schedule_note: str | None
    is_active: bool
    created_at: datetime

    coach_name: str | None = None
    coach_user_id: str | None = None
    center_name: str | None = None
    center_city: str | None = None
    athlete_ids: list[str] = []
    athlete_count: int = 0


class GroupMemberAdd(BaseModel):
    athlete_id: UUID
    join_date: date | None = None
