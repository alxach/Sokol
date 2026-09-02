from sqlalchemy import select

from app.models import Center, Coach, User
from app.repositories import (
    AthleteAchievementRepository,
    AthleteDocumentRepository,
    AthleteMedicalRepository,
    AthleteRankHistoryRepository,
    AthleteRepository,
    GroupMemberRepository,
)
from app.schemas.athlete import (
    AthleteAchievementCreate,
    AthleteCreate,
    AthleteDocumentCreate,
    AthleteMedicalCreate,
    AthleteRankCreate,
    AthleteResponse,
    AthleteUpdate,
)

# Статус, при котором спортсмен выводится из состава всех групп
# (архивирован) и автоматически исчезает из журнала посещаемости.
# Данные и история соревнований сохраняются.
REMOVED_FROM_GROUPS = {"inactive"}


class AthleteService:
    def __init__(
        self,
        athlete_repo: AthleteRepository,
        doc_repo: AthleteDocumentRepository,
        medical_repo: AthleteMedicalRepository,
        achievement_repo: AthleteAchievementRepository,
        ranks_repo: AthleteRankHistoryRepository,
        member_repo: GroupMemberRepository | None = None,
    ) -> None:
        self.athlete_repo = athlete_repo
        self.doc_repo = doc_repo
        self.medical_repo = medical_repo
        self.achievement_repo = achievement_repo
        self.ranks_repo = ranks_repo
        self.member_repo = member_repo

    async def create(self, data: AthleteCreate) -> AthleteResponse:
        athlete = await self.athlete_repo.create(**data.model_dump())
        return await self.to_response(athlete)

    async def get(self, athlete_id: str) -> AthleteResponse | None:
        instance = await self.athlete_repo.get(athlete_id)
        if not instance:
            return None
        return await self.to_response(instance)

    async def list(
        self, page: int = 1, per_page: int = 50,
        center_id: str | None = None, coach_id: str | None = None,
    ) -> tuple[list[AthleteResponse], int]:
        items, total = await self.athlete_repo.list(
            page=page, per_page=per_page,
            center_id=center_id, coach_id=coach_id,
        )
        return [await self.to_response(a) for a in items], total

    async def update(self, athlete_id: str, data: AthleteUpdate) -> AthleteResponse | None:
        clean = {k: v for k, v in data.model_dump().items() if v is not None}
        instance = await self.athlete_repo.update(athlete_id, **clean)
        if not instance:
            return None
        new_status = data.status
        if (
            self.member_repo is not None
            and new_status in REMOVED_FROM_GROUPS
        ):
            await self.member_repo.remove_all_for_athlete(athlete_id)
        return await self.to_response(instance)

    async def transfer(self, athlete_id: str, new_coach_id: str) -> AthleteResponse | None:
        instance = await self.athlete_repo.get(athlete_id)
        if not instance:
            return None
        if instance.status != "inactive":
            raise ValueError("Передавать можно только архивированного спортсмена")
        coach = await self.athlete_repo.session.execute(
            select(Coach).where(Coach.id == new_coach_id)
        )
        if coach.scalar_one_or_none() is None:
            raise ValueError("Тренер не найден")
        updated = await self.athlete_repo.update(athlete_id, coach_id=new_coach_id)
        return await self.to_response(updated)

    async def delete(self, athlete_id: str) -> bool:
        return await self.athlete_repo.delete(athlete_id)

    async def add_document(self, athlete_id: str, data: AthleteDocumentCreate):
        return await self.doc_repo.create(athlete_id=athlete_id, **data.model_dump())

    async def add_medical(self, athlete_id: str, data: AthleteMedicalCreate):
        return await self.medical_repo.create(athlete_id=athlete_id, **data.model_dump())

    async def add_rank(self, athlete_id: str, data: AthleteRankCreate):
        return await self.ranks_repo.create(athlete_id=athlete_id, **data.model_dump())

    async def add_achievement(self, athlete_id: str, data: AthleteAchievementCreate):
        return await self.achievement_repo.create(athlete_id=athlete_id, **data.model_dump())

    async def to_response(self, athlete) -> AthleteResponse:
        response = AthleteResponse.model_validate(athlete)
        coach_ids = [athlete.coach_id] if athlete.coach_id else []
        center_ids = [athlete.center_id] if athlete.center_id else []
        coaches = await self._coach_names(coach_ids)
        centers = await self._center_info(center_ids)
        if athlete.coach_id:
            coach_name, coach_user_id = coaches.get(str(athlete.coach_id), (None, None))
            response.coach_name = coach_name
            response.coach_user_id = coach_user_id
        if athlete.center_id:
            response.center_name = centers["names"].get(str(athlete.center_id))
            response.center_city = centers["cities"].get(str(athlete.center_id))
        return response

    async def _coach_names(
        self, coach_ids: list[str],
    ) -> dict[str, tuple[str | None, str | None]]:
        result: dict[str, tuple[str | None, str | None]] = {}
        if not coach_ids:
            return result
        coaches = (
            await self.athlete_repo.session.execute(
                select(Coach).where(Coach.id.in_(set(coach_ids)))
            )
        ).scalars().all()
        user_ids = [c.user_id for c in coaches if c.user_id]
        users: dict[str, User] = {}
        if user_ids:
            found = await self.athlete_repo.session.execute(
                select(User).where(User.id.in_(set(user_ids)))
            )
            users = {u.id: u for u in found.scalars().all()}
        for c in coaches:
            u = users.get(c.user_id)
            if u:
                result[str(c.id)] = (
                    self._full_name(u),
                    str(u.id),
                )
        return result

    async def _center_info(
        self, center_ids: list[str],
    ) -> dict[str, dict[str, str]]:
        names: dict[str, str] = {}
        cities: dict[str, str] = {}
        if not center_ids:
            return {"names": names, "cities": cities}
        centers = (
            await self.athlete_repo.session.execute(
                select(Center).where(Center.id.in_(set(center_ids)))
            )
        ).scalars().all()
        for c in centers:
            names[str(c.id)] = c.name
            cities[str(c.id)] = c.city or ""
        return {"names": names, "cities": cities}

    @staticmethod
    def _full_name(user: User) -> str:
        return " ".join(
            p for p in (user.last_name, user.first_name, user.middle_name or "") if p
        ) or None
