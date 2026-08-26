from fastapi import APIRouter, Depends

from app.core.dependencies import require_roles
from app.dependencies import get_coach_service
from app.schemas.coach import CoachCreate, CoachUpdate
from app.services.coach_service import CoachService

router = APIRouter(
    prefix="/coaches",
    tags=["coaches"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


@router.post("", dependencies=[Depends(require_roles("admin", "director"))])
async def create_coach(
    data: CoachCreate,
    service: CoachService = Depends(get_coach_service),
):
    return await service.create(data)


@router.get("")
async def list_coaches(
    page: int = 1,
    per_page: int = 50,
    center_id: str | None = None,
    service: CoachService = Depends(get_coach_service),
):
    return await service.list(page, per_page, center_id)


@router.get("/{coach_id}")
async def get_coach(
    coach_id: str,
    service: CoachService = Depends(get_coach_service),
):
    return await service.get(coach_id)


@router.patch("/{coach_id}", dependencies=[Depends(require_roles("admin", "director"))])
async def update_coach(
    coach_id: str,
    data: CoachUpdate,
    service: CoachService = Depends(get_coach_service),
):
    return await service.update(coach_id, data)
