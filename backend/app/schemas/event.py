from datetime import date

from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    name: str
    event_type: str
    level: str | None = None
    city: str | None = None
    center_id: str | None = None
    start_date: date
    end_date: date
    location: str
    description: str | None = None


class EventUpdate(BaseModel):
    name: str | None = None
    event_type: str | None = None
    level: str | None = None
    city: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    location: str | None = None
    description: str | None = None
    status: str | None = None


class CompetitionCreate(BaseModel):
    name: str
    discipline: str
    age_group: str | None = None
    gender: str | None = None
    weight_category: str | None = None
    competition_type: str
    max_participants: int | None = None


class CompetitionUpdate(BaseModel):
    name: str | None = None
    discipline: str | None = None
    competition_type: str | None = None
    status: str | None = None


class ParticipantRegister(BaseModel):
    athlete_id: str


class ResultUpsert(BaseModel):
    result: str


class ResultCreate(BaseModel):
    athlete_id: str
    stage: str | None = None
    position: int | None = None
    score: str | None = None
    medal: str | None = None
    model_config = ConfigDict(extra="ignore")