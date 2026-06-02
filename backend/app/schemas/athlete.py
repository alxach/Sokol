from datetime import date

from pydantic import BaseModel


class AthleteCreate(BaseModel):
    first_name: str
    last_name: str
    middle_name: str | None = None
    birth_date: date
    gender: str
    center_id: str | None = None
    coach_id: str | None = None
    sport_type: str
    notes: str | None = None


class AthleteUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    sport_type: str | None = None
    rank: str | None = None
    status: str | None = None
    notes: str | None = None


class AthleteResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    middle_name: str | None
    birth_date: date
    gender: str
    center_id: str | None
    coach_id: str | None
    sport_type: str
    rank: str | None
    status: str
    enrollment_type: str
    notes: str | None
    created_at: str


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
