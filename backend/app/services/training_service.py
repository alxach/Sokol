from datetime import date, time

from fastapi import HTTPException
from sqlalchemy import select

from app.core.dependencies import CurrentUser
from app.models.coach import Coach
from app.models.event_plan import EventPlan, PlanItem
from app.models.training import Training
from app.models.user import User
from app.repositories import (
    CenterRepository,
    CoachRepository,
    EventPlanRepository,
    PlanItemRepository,
    TrainingRepository,
)
from app.schemas.training import (
    TrainingCreate,
    TrainingOut,
    TrainingSelect,
    TrainingUpdate,
)

TRAINING_NAME = "Тренировка с сотрудниками РУСАЛа"
PLAN_CATEGORY = "4"


class TrainingService:
    def __init__(
        self,
        training_repo: TrainingRepository,
        coach_repo: CoachRepository,
        center_repo: CenterRepository,
        plan_repo: EventPlanRepository,
        item_repo: PlanItemRepository,
    ) -> None:
        self.training_repo = training_repo
        self.coach_repo = coach_repo
        self.center_repo = center_repo
        self.plan_repo = plan_repo
        self.item_repo = item_repo

    # ------------------------------------------------------------- helpers

    async def _user_row(self, user: CurrentUser) -> User:
        result = await self.training_repo.session.execute(
            select(User).where(User.id == user.id),
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return row

    async def _coach_of(self, user: CurrentUser) -> Coach | None:
        coaches, _ = await self.coach_repo.list(user_id=user.id)
        return coaches[0] if coaches else None

    def _is_claimant_level(self, user: CurrentUser) -> bool:
        return user.has_any_role("admin", "director") or "superadmin" in user.roles

    async def _resolve_center(
        self, user: CurrentUser, requested: str | None = None,
    ) -> str | None:
        if "superadmin" in user.roles:
            return requested
        if "director" in user.roles:
            if requested:
                return requested
            row = await self._user_row(user)
            return str(row.center_id) if row.center_id else None
        if "admin" in user.roles:
            row = await self._user_row(user)
            return str(row.center_id) if row.center_id else None
        coach = await self._coach_of(user)
        return str(coach.center_id) if coach and coach.center_id else None

    async def _to_out(self, training: Training) -> TrainingOut:
        coach_name = ""
        coach_user_id: str | None = None
        if training.coach_id:
            coaches, _ = await self.coach_repo.list(id=str(training.coach_id))
            if coaches:
                coach = coaches[0]
                result = await self.training_repo.session.execute(
                    select(User).where(User.id == coach.user_id),
                )
                user = result.scalar_one_or_none()
                if user:
                    coach_name = f"{user.last_name} {user.first_name}"
                    coach_user_id = str(user.id)
        center = await self.center_repo.get(str(training.center_id))
        return TrainingOut(
            id=str(training.id),
            center_id=str(training.center_id),
            center_name=center.name if center else "",
            coach_id=str(training.coach_id) if training.coach_id else None,
            coach_name=coach_name,
            coach_user_id=coach_user_id,
            date=training.date,
            start_time=training.start_time,
            location=training.location,
            participants_count=training.participants_count,
            goal=training.goal,
            status=training.status,
            plan_item_id=str(training.plan_item_id) if training.plan_item_id else None,
            created_by=str(training.created_by),
            created_at=training.created_at,
            updated_at=training.updated_at,
        )

    async def _training_or_404(self, training_id: str) -> Training:
        training = await self.training_repo.get(training_id)
        if not training:
            raise HTTPException(status_code=404, detail="Training not found")
        return training

    async def _check_center_scope(
        self, training: Training, user: CurrentUser,
    ) -> None:
        if "superadmin" in user.roles:
            return
        center = await self._resolve_center(user)
        if not center or str(training.center_id) != str(center):
            raise HTTPException(
                status_code=403, detail="Нет доступа к тренировкам этого центра",
            )

    # -------------------------------------------------------------- create

    async def create(self, data: TrainingCreate, user: CurrentUser) -> TrainingOut:
        center_id = await self._resolve_center(user, data.center_id)
        if not center_id:
            raise HTTPException(
                status_code=422, detail="Не указан центр тренировки",
            )
        training = await self.training_repo.create(
            center_id=center_id,
            coach_id=None,
            date=data.date,
            start_time=data.start_time,
            location=data.location,
            status="proposed",
            created_by=user.id,
        )
        return await self._to_out(training)

    # --------------------------------------------------------------- listing

    async def list(
        self,
        user: CurrentUser,
        center_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        status: str | None = None,
        coach_id: str | None = None,
        page: int = 1,
        per_page: int = 100,
    ) -> list[TrainingOut]:
        center = await self._resolve_center(user, center_id)
        if not center:
            return []
        if "coach" in user.roles and not self._is_claimant_level(user):
            own = await self._coach_of(user)
            if coach_id and own and str(coach_id) != str(own.id):
                raise HTTPException(
                    status_code=403, detail="Нет доступа к чужим тренировкам",
                )
        rows, _ = await self.training_repo.list_filtered(
            center_id=center,
            date_from=date_from,
            date_to=date_to,
            status=status,
            coach_id=coach_id,
            page=page,
            per_page=per_page,
        )
        return [await self._to_out(t) for t in rows]

    # --------------------------------------------------------------- update

    async def update(
        self, training_id: str, data: TrainingUpdate, user: CurrentUser,
    ) -> TrainingOut:
        training = await self._training_or_404(training_id)
        await self._check_center_scope(training, user)
        if training.status != "proposed":
            raise HTTPException(
                status_code=422, detail="Редактировать можно только предложенный слот",
            )
        payload = data.model_dump(exclude_unset=True)
        if not payload:
            raise HTTPException(status_code=422, detail="Nothing to update")
        for key, value in payload.items():
            setattr(training, key, value)
        await self.training_repo.session.flush()
        await self.training_repo.session.refresh(training)
        return await self._to_out(training)

    # --------------------------------------------------------------- delete

    async def delete(self, training_id: str, user: CurrentUser) -> dict:
        training = await self._training_or_404(training_id)
        await self._check_center_scope(training, user)
        if training.status != "proposed":
            raise HTTPException(
                status_code=422, detail="Удалить можно только предложенный слот",
            )
        await self.training_repo.delete(training_id)
        return {"ok": True}

    # ---------------------------------------------------------------- select

    async def select(
        self, training_id: str, data: TrainingSelect, user: CurrentUser,
    ) -> TrainingOut:
        training = await self._training_or_404(training_id)
        if training.status != "proposed":
            raise HTTPException(status_code=422, detail="Слот уже занят")
        if training.coach_id is not None:
            raise HTTPException(
                status_code=422, detail="Слот уже занят другим тренером",
            )
        coach = await self._coach_of(user)
        if not coach:
            raise HTTPException(
                status_code=403, detail="Тренерский профиль не найден",
            )
        if not coach.center_id or str(coach.center_id) != str(training.center_id):
            raise HTTPException(
                status_code=403, detail="Нет доступа к тренировкам этого центра",
            )
        conflicts = await self.training_repo.get_conflicts(
            str(coach.id), training.date,
        )
        if conflicts:
            raise HTTPException(
                status_code=422,
                detail="У вас уже есть тренировка в этот день",
            )

        training.coach_id = coach.id
        training.participants_count = None
        training.goal = data.goal
        training.status = "confirmed"
        training.plan_item_id = await self._sync_plan(
            coach_id=str(coach.id),
            center_id=str(training.center_id),
            day=training.date,
            location=training.location,
            goal=data.goal,
        )
        await self.training_repo.session.flush()
        await self.training_repo.session.refresh(training)
        return await self._to_out(training)

    async def _sync_plan(
        self,
        coach_id: str,
        center_id: str,
        day: date,
        location: str,
        goal: str,
    ) -> str | None:
        plans, _ = await self.plan_repo.list(
            coach_id=coach_id, center_id=center_id, year=day.year,
        )
        plan = plans[0] if plans else None
        if not plan:
            plan = await self.plan_repo.create(
                coach_id=coach_id,
                center_id=center_id,
                year=day.year,
                status="draft",
            )
        quarter = (day.month - 1) // 3 + 1
        item = await self.item_repo.create(
            plan_id=str(plan.id),
            category=PLAN_CATEGORY,
            quarter=quarter,
            month=day.month,
            date=f"{day:%d.%m.%Y}",
            name=TRAINING_NAME,
            description=goal,
            location=location,
            participants_count=None,
            status="draft",
        )
        return str(item.id)

    # ---------------------------------------------------------------- cancel

    async def cancel(self, training_id: str, user: CurrentUser) -> TrainingOut:
        training = await self._training_or_404(training_id)
        await self._check_center_scope(training, user)
        if training.status != "confirmed":
            raise HTTPException(
                status_code=422,
                detail="Отменить можно только подтверждённую тренировку",
            )
        if training.plan_item_id:
            await self.item_repo.delete(str(training.plan_item_id))
        training.coach_id = None
        training.participants_count = None
        training.goal = None
        training.plan_item_id = None
        training.status = "proposed"
        await self.training_repo.session.flush()
        await self.training_repo.session.refresh(training)
        return await self._to_out(training)

    # ---------------------------------------------------------- attendance

    async def set_attendance(
        self, training_id: str, participants_count: int, user: CurrentUser,
    ) -> TrainingOut:
        training = await self._training_or_404(training_id)
        await self._check_center_scope(training, user)
        if training.status != "confirmed":
            raise HTTPException(
                status_code=422,
                detail="Фактическое кол-во можно указать только для подтверждённой тренировки",
            )
        if "coach" in user.roles and not self._is_claimant_level(user):
            coach = await self._coach_of(user)
            if not coach or not training.coach_id or str(coach.id) != str(training.coach_id):
                raise HTTPException(
                    status_code=403, detail="Можно отметить только свою тренировку",
                )
        training.participants_count = participants_count
        if training.plan_item_id:
            await self.item_repo.update(
                str(training.plan_item_id),
                participants_count=str(participants_count),
            )
        await self.training_repo.session.flush()
        await self.training_repo.session.refresh(training)
        return await self._to_out(training)