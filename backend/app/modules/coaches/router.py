from fastapi import APIRouter, Depends

from app.core.dependencies import CurrentUser, get_current_user, get_current_user_id, require_roles
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
    user: CurrentUser = Depends(get_current_user),
    service: CoachService = Depends(get_coach_service),
):
    return await service.list(page, per_page, center_id, user)


@router.get("/me")
async def get_my_coach(
    user_id: str = Depends(get_current_user_id),
    service: CoachService = Depends(get_coach_service),
):
    coach = await service.get_by_user_id(user_id)
    if not coach:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")
    return coach


@router.patch("/me")
async def update_my_coach(
    data: CoachUpdate,
    user_id: str = Depends(get_current_user_id),
    current_user: CurrentUser = Depends(get_current_user),
    service: CoachService = Depends(get_coach_service),
):
    return await service.update_by_user_id(user_id, data, current_user.roles, current_user.id)


@router.get("/{coach_id}")
async def get_coach(
    coach_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: CoachService = Depends(get_coach_service),
):
    coach = await service.get(coach_id, user)
    if not coach:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    return coach


@router.patch("/{coach_id}", dependencies=[Depends(require_roles("admin", "director"))])
async def update_coach(
    coach_id: str,
    data: CoachUpdate,
    user: CurrentUser = Depends(get_current_user),
    service: CoachService = Depends(get_coach_service),
):
    return await service.update(coach_id, data, user)
