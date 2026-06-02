from datetime import date

from pydantic import BaseModel


class EventCreate(BaseModel):
    name: str
    event_type: str
    center_id: str | None = None
    start_date: date
    end_date: date
    location: str
    description: str | None = None


class EventUpdate(BaseModel):
    name: str | None = None
    event_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    location: str | None = None
    description: str | None = None
    status: str | None = None


class EventResponse(BaseModel):
    id: str
    name: str
    event_type: str
    center_id: str | None
    start_date: date
    end_date: date
    location: str
    description: str | None
    status: str


class CompetitionCreate(BaseModel):
    name: str
    discipline: str
    age_group: str | None = None
    gender: str | None = None
    weight_category: str | None = None
    competition_type: str
    max_participants: int | None = None


class CompetitionResponse(BaseModel):
    id: str
    event_id: str
    name: str
    discipline: str
    competition_type: str
    status: str


class ParticipantRegister(BaseModel):
    athlete_id: str


class ResultCreate(BaseModel):
    athlete_id: str
    stage: str | None = None
    position: int | None = None
    score: str | None = None
    medal: str | None = None
