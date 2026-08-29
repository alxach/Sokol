from app.models.schedule import Schedule, SchedulePeriod
from app.repositories.base import BaseRepository


class ScheduleRepository(BaseRepository[Schedule]):
    def __init__(self, session):
        super().__init__(session, Schedule)


class SchedulePeriodRepository(BaseRepository[SchedulePeriod]):
    def __init__(self, session):
        super().__init__(session, SchedulePeriod)
