from app.models.coach import Coach
from app.repositories.base import BaseRepository


class CoachRepository(BaseRepository[Coach]):
    def __init__(self, session):
        super().__init__(session, Coach)
