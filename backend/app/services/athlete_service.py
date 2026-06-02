from app.repositories import (
    AthleteAchievementRepository,
    AthleteDocumentRepository,
    AthleteMedicalRepository,
    AthleteRankHistoryRepository,
    AthleteRepository,
)
from app.schemas.athlete import (
    AthleteAchievementCreate,
    AthleteCreate,
    AthleteDocumentCreate,
    AthleteMedicalCreate,
    AthleteRankCreate,
    AthleteUpdate,
)


class AthleteService:
    def __init__(
        self,
        athlete_repo: AthleteRepository,
        doc_repo: AthleteDocumentRepository,
        medical_repo: AthleteMedicalRepository,
        achievement_repo: AthleteAchievementRepository,
        ranks_repo: AthleteRankHistoryRepository,
    ) -> None:
        self.athlete_repo = athlete_repo
        self.doc_repo = doc_repo
        self.medical_repo = medical_repo
        self.achievement_repo = achievement_repo
        self.ranks_repo = ranks_repo

    async def create(self, data: AthleteCreate):
        return await self.athlete_repo.create(**data.model_dump())

    async def get(self, athlete_id: str):
        return await self.athlete_repo.get(athlete_id)

    async def list(
        self, page: int = 1, per_page: int = 50,
        center_id: str | None = None, coach_id: str | None = None,
    ):
        return await self.athlete_repo.list(
            page=page, per_page=per_page,
            center_id=center_id, coach_id=coach_id,
        )

    async def update(self, athlete_id: str, data: AthleteUpdate):
        clean = {k: v for k, v in data.model_dump().items() if v is not None}
        return await self.athlete_repo.update(athlete_id, **clean)

    async def add_document(self, athlete_id: str, data: AthleteDocumentCreate):
        return await self.doc_repo.create(athlete_id=athlete_id, **data.model_dump())

    async def add_medical(self, athlete_id: str, data: AthleteMedicalCreate):
        return await self.medical_repo.create(athlete_id=athlete_id, **data.model_dump())

    async def add_rank(self, athlete_id: str, data: AthleteRankCreate):
        return await self.ranks_repo.create(athlete_id=athlete_id, **data.model_dump())

    async def add_achievement(self, athlete_id: str, data: AthleteAchievementCreate):
        return await self.achievement_repo.create(athlete_id=athlete_id, **data.model_dump())
