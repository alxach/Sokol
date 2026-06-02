from app.models.organization import Center, Region
from app.repositories.base import BaseRepository


class RegionRepository(BaseRepository[Region]):
    def __init__(self, session):
        super().__init__(session, Region)


class CenterRepository(BaseRepository[Center]):
    def __init__(self, session):
        super().__init__(session, Center)
