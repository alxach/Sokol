from app.repositories import CoachRepository
from app.schemas.coach import CoachCreate, CoachUpdate


class CoachService:
    def __init__(self, coach_repo: CoachRepository) -> None:
        self.coach_repo = coach_repo

    async def create(self, data: CoachCreate):
        return await self.coach_repo.create(**data.model_dump())

    async def get(self, coach_id: str):
        return await self.coach_repo.get(coach_id)

    async def list(self, page: int = 1, per_page: int = 50, center_id: str | None = None):
        return await self.coach_repo.list(page=page, per_page=per_page, center_id=center_id)

    async def update(self, coach_id: str, data: CoachUpdate):
        clean = {k: v for k, v in data.model_dump().items() if v is not None}
        return await self.coach_repo.update(coach_id, **clean)
