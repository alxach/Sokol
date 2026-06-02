from app.repositories import ScheduleRepository
from app.schemas.schedule import ScheduleCreate


class ScheduleService:
    def __init__(self, schedule_repo: ScheduleRepository) -> None:
        self.schedule_repo = schedule_repo

    async def create(self, data: ScheduleCreate):
        return await self.schedule_repo.create(**data.model_dump())

    async def list_by_group(self, group_id: str):
        schedules, _ = await self.schedule_repo.list(group_id=group_id)
        return schedules

    async def delete(self, schedule_id: str):
        return await self.schedule_repo.delete(schedule_id)
