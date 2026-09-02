from datetime import date

from sqlalchemy import func, select

from app.models.training import Training
from app.repositories.base import BaseRepository


class TrainingRepository(BaseRepository[Training]):
    def __init__(self, session):
        super().__init__(session, Training)

    async def list_filtered(
        self,
        center_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        status: str | None = None,
        coach_id: str | None = None,
        page: int = 1,
        per_page: int = 100,
    ) -> tuple[list[Training], int]:
        stmt = select(Training)
        if center_id is not None:
            stmt = stmt.where(Training.center_id == center_id)
        if date_from is not None:
            stmt = stmt.where(Training.date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Training.date <= date_to)
        if status is not None:
            stmt = stmt.where(Training.status == status)
        if coach_id is not None:
            stmt = stmt.where(Training.coach_id == coach_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(Training.date, Training.start_time)
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def get_conflicts(self, coach_id: str, day: date) -> list[Training]:
        rows, _ = await self.list_filtered(
            coach_id=coach_id, date_from=day, date_to=day,
        )
        return [r for r in rows if r.status in ("proposed", "confirmed")]