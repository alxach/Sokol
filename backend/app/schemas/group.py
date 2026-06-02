from datetime import date

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    center_id: str | None = None
    coach_id: str | None = None
    sport_type: str
    age_group: str | None = None
    skill_level: str | None = None
    max_capacity: int = 30


class GroupResponse(BaseModel):
    id: str
    name: str
    center_id: str | None
    coach_id: str | None
    sport_type: str
    age_group: str | None
    skill_level: str | None
    max_capacity: int
    is_active: bool


class GroupMemberAdd(BaseModel):
    athlete_id: str
    join_date: date | None = None
