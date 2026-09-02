import uuid
from sqlalchemy import select

from app.models.coach import Coach
from app.repositories.base import BaseRepository


class CoachRepository(BaseRepository[Coach]):
    def __init__(self, session):
        super().__init__(session, Coach)

    async def get_by_user_id(self, user_id: str) -> Coach | None:
        stmt = select(self.model).where(self.model.user_id == uuid.UUID(user_id))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
