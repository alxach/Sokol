from fastapi import APIRouter, Depends

from app.core.dependencies import require_roles
from app.dependencies import get_athlete_service
from app.schemas.athlete import (
    AthleteAchievementCreate,
    AthleteCreate,
    AthleteDocumentCreate,
    AthleteMedicalCreate,
    AthleteRankCreate,
    AthleteUpdate,
)
from app.services.athlete_service import AthleteService

router = APIRouter(
    prefix="/athletes",
    tags=["athletes"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


@router.post("")
async def create_athlete(
    data: AthleteCreate,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.create(data)


@router.get("")
async def list_athletes(
    page: int = 1,
    per_page: int = 50,
    center_id: str | None = None,
    coach_id: str | None = None,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.list(page, per_page, center_id, coach_id)


@router.get("/{athlete_id}")
async def get_athlete(
    athlete_id: str,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.get(athlete_id)


@router.patch("/{athlete_id}")
async def update_athlete(
    athlete_id: str,
    data: AthleteUpdate,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.update(athlete_id, data)


@router.delete("/{athlete_id}")
async def delete_athlete(
    athlete_id: str,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.delete(athlete_id)


@router.post("/{athlete_id}/documents")
async def add_document(
    athlete_id: str,
    data: AthleteDocumentCreate,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.add_document(athlete_id, data)


@router.post("/{athlete_id}/medical")
async def add_medical(
    athlete_id: str,
    data: AthleteMedicalCreate,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.add_medical(athlete_id, data)


@router.post("/{athlete_id}/ranks")
async def add_rank(
    athlete_id: str,
    data: AthleteRankCreate,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.add_rank(athlete_id, data)


@router.post("/{athlete_id}/achievements")
async def add_achievement(
    athlete_id: str,
    data: AthleteAchievementCreate,
    service: AthleteService = Depends(get_athlete_service),
):
    return await service.add_achievement(athlete_id, data)
