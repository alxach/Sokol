from app.models.athlete import (
    Athlete,
    AthleteAchievement,
    AthleteDocument,
    AthleteMedical,
    AthleteRankHistory,
)
from app.repositories.base import BaseRepository


class AthleteRepository(BaseRepository[Athlete]):
    def __init__(self, session):
        super().__init__(session, Athlete)


class AthleteDocumentRepository(BaseRepository[AthleteDocument]):
    def __init__(self, session):
        super().__init__(session, AthleteDocument)


class AthleteMedicalRepository(BaseRepository[AthleteMedical]):
    def __init__(self, session):
        super().__init__(session, AthleteMedical)


class AthleteAchievementRepository(BaseRepository[AthleteAchievement]):
    def __init__(self, session):
        super().__init__(session, AthleteAchievement)


class AthleteRankHistoryRepository(BaseRepository[AthleteRankHistory]):
    def __init__(self, session):
        super().__init__(session, AthleteRankHistory)
