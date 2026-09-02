from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import CurrentUser, get_current_user, require_roles
from app.dependencies import get_training_service
from app.schemas.training import (
    TrainingAttendance,
    TrainingCreate,
    TrainingOut,
    TrainingSelect,
    TrainingUpdate,
)
from app.services.training_service import TrainingService

router = APIRouter(
    prefix="/trainings",
    tags=["trainings"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


@router.post("", dependencies=[Depends(require_roles("admin", "director"))])
async def create_training(
    data: TrainingCreate,
    user: CurrentUser = Depends(get_current_user),
    service: TrainingService = Depends(get_training_service),
):
    return await service.create(data, user)


@router.get("")
async def list_trainings(
    center_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    coach_id: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    service: TrainingService = Depends(get_training_service),
):
    return await service.list(
        user, center_id=center_id, date_from=date_from, date_to=date_to,
        status=status, coach_id=coach_id, page=page, per_page=per_page,
    )


@router.patch("/{training_id}", dependencies=[Depends(require_roles("admin", "director"))])
async def update_training(
    training_id: str,
    data: TrainingUpdate,
    user: CurrentUser = Depends(get_current_user),
    service: TrainingService = Depends(get_training_service),
):
    return await service.update(training_id, data, user)


@router.delete("/{training_id}", dependencies=[Depends(require_roles("admin", "director"))])
async def delete_training(
    training_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: TrainingService = Depends(get_training_service),
):
    return await service.delete(training_id, user)


@router.post("/{training_id}/select", dependencies=[Depends(require_roles("coach"))])
async def select_training(
    training_id: str,
    data: TrainingSelect,
    user: CurrentUser = Depends(get_current_user),
    service: TrainingService = Depends(get_training_service),
):
    return await service.select(training_id, data, user)


@router.post("/{training_id}/attendance")
async def set_training_attendance(
    training_id: str,
    data: TrainingAttendance,
    user: CurrentUser = Depends(get_current_user),
    service: TrainingService = Depends(get_training_service),
):
    return await service.set_attendance(
        training_id, data.participants_count, user,
    )


@router.post(
    "/{training_id}/cancel",
    dependencies=[Depends(require_roles("admin", "director"))],
)
async def cancel_training(
    training_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: TrainingService = Depends(get_training_service),
):
    return await service.cancel(training_id, user)