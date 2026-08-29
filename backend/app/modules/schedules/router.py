from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import require_roles
from app.dependencies import get_schedule_service
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleItemCreate,
    ScheduleItemUpdate,
    SchedulePeriodCreate,
    SchedulePeriodUpdate,
)
from app.services.schedule_service import ScheduleService

router = APIRouter(
    prefix="/schedules",
    tags=["schedules"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


def _not_found():
    return HTTPException(status_code=404, detail="Не найдено")


def _bad_request(exc: ValueError):
    return HTTPException(status_code=422, detail=str(exc))


# --- legacy flat schedules (retained for compatibility) ---


@router.post("")
async def create_schedule(
    data: ScheduleCreate,
    service: ScheduleService = Depends(get_schedule_service),
):
    return await service.create(data)


@router.get("/by-group/{group_id}")
async def list_by_group(
    group_id: str,
    service: ScheduleService = Depends(get_schedule_service),
):
    return await service.list_by_group(group_id)


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    service: ScheduleService = Depends(get_schedule_service),
):
    await service.delete(schedule_id)
    return {"ok": True}


# --- schedule periods ---


@router.get("/periods")
async def list_periods(
    group_id: str | None = None,
    coach_user_id: str | None = None,
    center_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 200,
    service: ScheduleService = Depends(get_schedule_service),
):
    return await service.list_periods(
        group_id=group_id,
        coach_user_id=coach_user_id,
        center_id=center_id,
        status=status,
        page=page,
        per_page=per_page,
    )


@router.post("/periods")
async def create_period(
    data: SchedulePeriodCreate,
    service: ScheduleService = Depends(get_schedule_service),
):
    try:
        return await service.create_period(data)
    except ValueError as exc:
        raise _bad_request(exc)


@router.get("/periods/{period_id}")
async def get_period(
    period_id: str,
    service: ScheduleService = Depends(get_schedule_service),
):
    period = await service.get_period(period_id)
    if not period:
        raise _not_found()
    return period


@router.patch("/periods/{period_id}")
async def update_period(
    period_id: str,
    data: SchedulePeriodUpdate,
    service: ScheduleService = Depends(get_schedule_service),
):
    try:
        period = await service.update_period(period_id, data)
    except ValueError as exc:
        raise _bad_request(exc)
    if not period:
        raise _not_found()
    return period


@router.delete("/periods/{period_id}")
async def archive_period(
    period_id: str,
    service: ScheduleService = Depends(get_schedule_service),
):
    ok = await service.archive_period(period_id)
    if not ok:
        raise _not_found()
    return {"ok": True}


@router.post("/periods/{period_id}/approve")
async def approve_period(
    period_id: str,
    service: ScheduleService = Depends(get_schedule_service),
):
    try:
        period = await service.approve_period(period_id)
    except ValueError as exc:
        raise _bad_request(exc)
    if not period:
        raise _not_found()
    return period


@router.post("/periods/{period_id}/duplicate")
async def duplicate_period(
    period_id: str,
    service: ScheduleService = Depends(get_schedule_service),
):
    period = await service.duplicate_period(period_id)
    if not period:
        raise _not_found()
    return period


# --- schedule items (lessons inside a period) ---


@router.post("/periods/{period_id}/items")
async def create_item(
    period_id: str,
    data: ScheduleItemCreate,
    service: ScheduleService = Depends(get_schedule_service),
):
    try:
        return await service.create_item(period_id, data)
    except ValueError as exc:
        raise _bad_request(exc)


@router.patch("/periods/items/{schedule_id}")
async def update_item(
    schedule_id: str,
    data: ScheduleItemUpdate,
    service: ScheduleService = Depends(get_schedule_service),
):
    try:
        item = await service.update_item(schedule_id, data)
    except ValueError as exc:
        raise _bad_request(exc)
    if not item:
        raise _not_found()
    return item


@router.delete("/periods/items/{schedule_id}")
async def delete_item(
    schedule_id: str,
    service: ScheduleService = Depends(get_schedule_service),
):
    try:
        ok = await service.delete_item(schedule_id)
    except ValueError as exc:
        raise _bad_request(exc)
    if not ok:
        raise _not_found()
    return {"ok": True}
