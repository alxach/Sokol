from app.models.event import Competition, Event, Participant, Result
from app.repositories.base import BaseRepository


class EventRepository(BaseRepository[Event]):
    def __init__(self, session):
        super().__init__(session, Event)


class CompetitionRepository(BaseRepository[Competition]):
    def __init__(self, session):
        super().__init__(session, Competition)


class ParticipantRepository(BaseRepository[Participant]):
    def __init__(self, session):
        super().__init__(session, Participant)


class ResultRepository(BaseRepository[Result]):
    def __init__(self, session):
        super().__init__(session, Result)
