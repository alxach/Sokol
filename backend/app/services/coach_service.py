from app.models.coach import CoachSickLeave, CoachVacation
from app.repositories import CoachRepository
from app.schemas.coach import CoachCreate, CoachUpdate


class CoachService:
    def __init__(self, coach_repo: CoachRepository) -> None:
        self.coach_repo = coach_repo

    async def create(self, data: CoachCreate):
        dump = data.model_dump()
        vacations_data = dump.pop("vacations", [])
        sick_leaves_data = dump.pop("sick_leaves", [])
        coach = await self.coach_repo.create(**dump)
        for v in vacations_data:
            coach.vacations.append(CoachVacation(**v))
        for s in sick_leaves_data:
            coach.sick_leaves.append(CoachSickLeave(**s))
        await self.coach_repo.session.flush()
        return coach

    async def get(self, coach_id: str):
        return await self.coach_repo.get(coach_id)

    async def list(self, page: int = 1, per_page: int = 50, center_id: str | None = None):
        return await self.coach_repo.list(page=page, per_page=per_page, center_id=center_id)

    async def update(self, coach_id: str, data: CoachUpdate):
        dump = data.model_dump(exclude_none=True)
        vacations_data = dump.pop("vacations", None)
        sick_leaves_data = dump.pop("sick_leaves", None)
        coach = await self.coach_repo.get(coach_id)
        if not coach:
            return None
        if vacations_data is not None:
            coach.vacations.clear()
            for v in vacations_data:
                coach.vacations.append(CoachVacation(**v))
        if sick_leaves_data is not None:
            coach.sick_leaves.clear()
            for s in sick_leaves_data:
                coach.sick_leaves.append(CoachSickLeave(**s))
        if vacations_data is not None or sick_leaves_data is not None:
            await self.coach_repo.session.flush()
        clean = {k: v for k, v in dump.items() if v is not None}
        return await self.coach_repo.update(coach_id, **clean)
