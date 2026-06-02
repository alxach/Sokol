from fastapi import APIRouter, Depends

from app.dependencies import get_schedule_service
from app.schemas.schedule import ScheduleCreate
from app.services.schedule_service import ScheduleService

router = APIRouter(prefix="/schedules", tags=["schedules"])


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
