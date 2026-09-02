from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

AthleteStatus = Literal["active", "inactive"]


class AthleteCreate(BaseModel):
    first_name: str
    last_name: str
    middle_name: str | None = None
    birth_date: date
    gender: str
    center_id: str | None = None
    coach_id: str | None = None
    sport_type: str
    rank: str | None = None
    status: AthleteStatus = "active"
    notes: str | None = None


class AthleteUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    sport_type: str | None = None
    rank: str | None = None
    status: AthleteStatus | None = None
    notes: str | None = None


class AthleteTransferCreate(BaseModel):
    new_coach_id: UUID


class AthleteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    middle_name: str | None
    birth_date: date
    gender: str
    center_id: UUID | None
    coach_id: UUID | None
    sport_type: str
    rank: str | None
    status: str
    enrollment_type: str
    notes: str | None
    created_at: datetime
    coach_name: str | None = None
    coach_user_id: str | None = None
    center_name: str | None = None
    center_city: str | None = None


class AthleteDocumentCreate(BaseModel):
    doc_type: str
    doc_number: str | None = None
    issue_date: date | None = None
    expire_date: date | None = None
    file_url: str | None = None


class AthleteMedicalCreate(BaseModel):
    medical_type: str
    examination_date: date
    valid_until: date
    diagnosis: str | None = None
    doctor_name: str | None = None


class AthleteRankCreate(BaseModel):
    rank_after: str
    rank_before: str | None = None
    assign_date: date
    order_number: str | None = None


class AthleteAchievementCreate(BaseModel):
    achievement_type: str
    place: str | None = None
    medal: str | None = None
    date: date
    description: str | None = None
    competition_id: str | None = None
