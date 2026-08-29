from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user_id, require_roles
from app.dependencies import get_event_service
from app.schemas.event import (
    CompetitionCreate,
    CompetitionUpdate,
    EventCreate,
    EventUpdate,
    ParticipantRegister,
    ResultCreate,
    ResultUpsert,
)
from app.services.event_service import EventService

router = APIRouter(
    prefix="/events",
    tags=["events"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


@router.post("")
async def create_event(
    data: EventCreate,
    organizer_id: str | None = Depends(get_current_user_id),
    service: EventService = Depends(get_event_service),
):
    return await service.create_event(data, organizer_id=organizer_id)


@router.get("")
async def list_events(
    page: int = 1,
    per_page: int = 50,
    event_type: str | None = None,
    status: str | None = None,
    service: EventService = Depends(get_event_service),
):
    return await service.list_with_counts(page, per_page, event_type=event_type, status=status)


@router.get("/competitions")
async def list_competitions(
    event_type: str | None = "competition",
    status: str | None = None,
    service: EventService = Depends(get_event_service),
):
    return await service.list_competitions(event_type=event_type, status=status)


@router.get("/stats")
async def event_stats(
    service: EventService = Depends(get_event_service),
):
    return await service.get_stats()


@router.get("/{event_id}")
async def get_event(
    event_id: str,
    service: EventService = Depends(get_event_service),
):
    return await service.get_event(event_id)


@router.patch("/{event_id}")
async def update_event(
    event_id: str,
    data: EventUpdate,
    service: EventService = Depends(get_event_service),
):
    return await service.update_event(event_id, data)


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    service: EventService = Depends(get_event_service),
):
    return await service.delete_event(event_id)


@router.post("/{event_id}/competitions")
async def add_competition(
    event_id: str,
    data: CompetitionCreate,
    service: EventService = Depends(get_event_service),
):
    return await service.add_competition(event_id, data)


@router.patch("/competitions/{competition_id}")
async def update_competition(
    competition_id: str,
    data: CompetitionUpdate,
    service: EventService = Depends(get_event_service),
):
    return await service.update_competition(competition_id, data)


@router.delete("/competitions/{competition_id}")
async def delete_competition(
    competition_id: str,
    service: EventService = Depends(get_event_service),
):
    return await service.delete_competition(competition_id)


@router.post("/competitions/{competition_id}/participants")
async def register_participant(
    competition_id: str,
    data: ParticipantRegister,
    service: EventService = Depends(get_event_service),
):
    return await service.register_participant(competition_id, data)


@router.delete("/competitions/{competition_id}/participants/{athlete_id}")
async def remove_participant(
    competition_id: str,
    athlete_id: str,
    service: EventService = Depends(get_event_service),
):
    return await service.remove_participant(competition_id, athlete_id)


@router.put("/competitions/{competition_id}/results/{athlete_id}")
async def upsert_result(
    competition_id: str,
    athlete_id: str,
    data: ResultUpsert,
    service: EventService = Depends(get_event_service),
):
    return await service.upsert_result(competition_id, athlete_id, data.result)


@router.delete("/competitions/{competition_id}/results/{athlete_id}")
async def delete_result(
    competition_id: str,
    athlete_id: str,
    service: EventService = Depends(get_event_service),
):
    return await service.delete_result(competition_id, athlete_id)


@router.post("/competitions/{competition_id}/results")
async def add_result(
    competition_id: str,
    data: ResultCreate,
    service: EventService = Depends(get_event_service),
):
    return await service.add_result(competition_id, data)