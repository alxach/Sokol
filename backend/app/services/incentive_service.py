from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import CurrentUser
from app.models.coach import Coach
from app.models.commission import CommissionProtocol
from app.models.event_plan import EventPlan, PlanItem
from app.models.incentive_criteria import IncentiveCriteria
from app.models.user import User
from app.repositories import (
    CenterRepository,
    CoachRepository,
    CommissionProtocolRepository,
    EventPlanRepository,
    IncentiveCriteriaRepository,
    IncentiveProgramRepository,
    PayoutRowRepository,
    PlanItemRepository,
)
from app.schemas.incentive import (
    CoachTierOut,
    CoachTierUpdate,
    CommissionProtocolCreate,
    CommissionProtocolOut,
    CommissionProtocolUpdate,
    EventPlanCreate,
    EventPlanOut,
    EventPlanUpdate,
    IncentiveCriteriaOut,
    IncentiveCriteriaUpsert,
    IncentiveProgramCreate,
    IncentiveProgramUpdate,
    PayoutRowCreate,
    PayoutRowOut,
    PlanItemCreate,
    PlanItemOut,
    PlanItemUpdate,
)
from app.services.incentive_calc import breakdown_from_gross, validate_tier

DEFAULT_NDFL_RATE = 13.0
DEFAULT_INSURANCE_RATE = 30.2
DEFAULT_MIN_PAYOUT = 25000
DEFAULT_MAX_PAYOUT = 50000

_UTC = timezone.utc  # noqa: UP017 - this 3.14 build lacks datetime.UTC
_PLAN_ITEM_STATUSES = {"draft", "submitted", "approved", "rejected"}


def _initials_of(user: User) -> str:
    parts = [user.last_name, user.first_name, user.middle_name or ""]
    letters = [p[0] for p in parts if p]
    return "".join(letters[:2]).upper()


def aggregate_plan_status(items: list[PlanItem]) -> str:
    counts = {"draft": 0, "submitted": 0, "approved": 0, "rejected": 0}
    for item in items:
        if item.status in counts:
            counts[item.status] += 1
    if counts["submitted"] > 0:
        return "submitted"
    if counts["rejected"] > 0:
        return "rejected"
    if counts["approved"] > 0 and counts["draft"] == 0:
        return "approved"
    return "draft"


class IncentiveService:
    def __init__(
        self,
        program_repo: IncentiveProgramRepository,
        plan_repo: EventPlanRepository,
        item_repo: PlanItemRepository,
        protocol_repo: CommissionProtocolRepository,
        payout_repo: PayoutRowRepository,
        coach_repo: CoachRepository,
        center_repo: CenterRepository,
        criteria_repo: IncentiveCriteriaRepository,
    ) -> None:
        self.program_repo = program_repo
        self.plan_repo = plan_repo
        self.item_repo = item_repo
        self.protocol_repo = protocol_repo
        self.payout_repo = payout_repo
        self.coach_repo = coach_repo
        self.center_repo = center_repo
        self.criteria_repo = criteria_repo

    # ------------------------------------------------------------------ helpers

    async def _user_row(self, user: CurrentUser) -> User:
        result = await self.plan_repo.session.execute(
            select(User).where(User.id == user.id),
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return row

    async def _coach_of(self, user: CurrentUser) -> Coach | None:
        coaches, _ = await self.coach_repo.list(user_id=user.id)
        return coaches[0] if coaches else None

    async def _center_name(self, center_id: str | None) -> str:
        if not center_id:
            return ""
        center = await self.center_repo.get(center_id)
        return center.name if center else ""

    async def _plan_items(self, plan_id: str) -> list[PlanItem]:
        items, _ = await self.item_repo.list(plan_id=plan_id)
        return items

    async def _enrich_plan(self, plan: EventPlan) -> EventPlanOut:
        items = await self._plan_items(plan.id)
        coach_name = ""
        coach_initials = ""
        discipline = ""
        coaches, _ = await self.coach_repo.list(id=plan.coach_id)
        if coaches:
            coach = coaches[0]
            discipline = coach.specialization
            result = await self.plan_repo.session.execute(
                select(User).where(User.id == coach.user_id),
            )
            user = result.scalar_one_or_none()
            if user:
                coach_name = f"{user.last_name} {user.first_name}" + (
                    f" {user.middle_name}" if user.middle_name else ""
                )
                coach_initials = _initials_of(user)
        return EventPlanOut(
            id=str(plan.id),
            coach_id=str(plan.coach_id),
            coach_user_id=str(coach.user_id) if coaches else None,
            coach_name=coach_name,
            coach_initials=coach_initials,
            discipline=discipline,
            center_id=str(plan.center_id),
            center_name=await self._center_name(str(plan.center_id)),
            program_id=str(plan.program_id) if plan.program_id else None,
            year=plan.year,
            status=aggregate_plan_status(items),
            review_comment=plan.review_comment,
            created_at=plan.created_at,
            items=[PlanItemOut.model_validate(item) for item in items],
        )

    async def _get_plan_or_404(self, plan_id: str) -> EventPlan:
        plan = await self.plan_repo.get(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan

    async def _own_coach_or_403(self, user: CurrentUser) -> Coach:
        coach = await self._coach_of(user)
        if not coach:
            raise HTTPException(
                status_code=403, detail="Тренерский профиль не найден",
            )
        return coach

    def _require_item_draft(
        self, item: PlanItem, message: str = "Разрешены только черновики",
    ) -> None:
        if item.status != "draft":
            raise HTTPException(status_code=422, detail=message)

    async def _is_reviewer(self, user: CurrentUser) -> bool:
        return user.has_any_role("admin", "director") or "superadmin" in user.roles

    def _can_review(self, user: CurrentUser, plan: EventPlan, user_row: User) -> bool:
        if "superadmin" in user.roles:
            return True
        if "director" in user.roles:
            return True
        if "admin" in user.roles:
            return user_row.center_id is not None and str(user_row.center_id) == str(plan.center_id)
        return False

    # ------------------------------------------------------------------ programs

    async def list_programs(self):
        programs, _ = await self.program_repo.list()
        return programs

    async def get_program(self, id: str):
        return await self.program_repo.get(id)

    async def create_program(self, data: IncentiveProgramCreate):
        try:
            return await self.program_repo.create(**data.model_dump())
        except IntegrityError:
            await self.program_repo.session.rollback()
            raise HTTPException(
                status_code=409, detail="regulation_number already exists",
            )

    async def update_program(self, program_id: str, data: IncentiveProgramUpdate):
        program = await self.program_repo.get(program_id)
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(program, key, value)
        try:
            await self.program_repo.session.flush()
        except IntegrityError:
            await self.program_repo.session.rollback()
            raise HTTPException(
                status_code=409, detail="regulation_number already exists",
            )
        return program

    # ------------------------------------------------------------------ criteria

    async def get_criteria(
        self, user: CurrentUser, center_id: str | None = None,
    ) -> list[IncentiveCriteriaOut]:
        target_center = center_id
        if "coach" in user.roles and not user.has_any_role("admin", "director", "superadmin"):
            coach = await self._coach_of(user)
            if not coach or not coach.center_id:
                return []
            target_center = str(coach.center_id)
        elif "admin" in user.roles and not user.has_any_role("director", "superadmin"):
            user_row = await self._user_row(user)
            if not user_row.center_id:
                return []
            target_center = str(user_row.center_id)

        rows: list[IncentiveCriteria] = []
        own_coach: Coach | None = None
        if target_center:
            if "coach" in user.roles and not user.has_any_role("admin", "director", "superadmin"):
                own_coach = await self._coach_of(user) or own_coach
            row = await self.criteria_repo.get_by_center(target_center)
            rows = [row] if row else []
        else:
            rows, _ = await self.criteria_repo.list()

        result = []
        for row in rows:
            out = IncentiveCriteriaOut.model_validate(row)
            out.center_name = await self._center_name(str(row.center_id))
            if own_coach and out.center_id == own_coach.center_id:
                out.assigned_tier = own_coach.incentive_tier
            result.append(out)
        return result

    async def upsert_criteria(
        self, center_id: str, data: IncentiveCriteriaUpsert, user: CurrentUser,
    ) -> IncentiveCriteriaOut:
        if "coach" in user.roles and not user.has_any_role("admin", "director", "superadmin"):
            raise HTTPException(
                status_code=403, detail="Тренер не может изменять критерии",
            )
        if "admin" in user.roles and not user.has_any_role("director", "superadmin"):
            user_row = await self._user_row(user)
            if not user_row.center_id or str(user_row.center_id) != str(center_id):
                raise HTTPException(
                    status_code=403,
                    detail="Администратор может изменять критерии только своего центра",
                )

        try:
            data.validate_levels()
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        payload = data.model_dump()
        row = await self.criteria_repo.get_by_center(center_id)
        if row:
            for key, value in payload.items():
                setattr(row, key, value)
            row.updated_by = user.id
            try:
                await self.criteria_repo.session.flush()
                await self.criteria_repo.session.refresh(row)
            except IntegrityError:
                await self.criteria_repo.session.rollback()
                raise HTTPException(status_code=409, detail="Conflict on criteria update")
        else:
            row = await self.criteria_repo.create(
                center_id=center_id, updated_by=user.id, **payload,
            )
            await self.criteria_repo.session.refresh(row)

        out = IncentiveCriteriaOut.model_validate(row)
        out.center_name = await self._center_name(str(row.center_id))
        return out

    # ------------------------------------------------------------------ coach tiers

    async def _check_tier_manage_rights(self, user: CurrentUser, coach: Coach) -> User:
        if "superadmin" in user.roles or "director" in user.roles:
            return await self._user_row(user)
        if "admin" in user.roles:
            user_row = await self._user_row(user)
            if not user_row.center_id:
                raise HTTPException(
                    status_code=403, detail="Администратор не привязан к центру",
                )
            if coach.center_id and str(user_row.center_id) != str(coach.center_id):
                raise HTTPException(
                    status_code=403,
                    detail="Администратор может назначать тир только тренерам своего центра",
                )
            return user_row
        raise HTTPException(status_code=403, detail="Нет прав на назначение тира")

    async def list_coach_tiers(
        self, user: CurrentUser, center_id: str | None = None,
    ) -> list[CoachTierOut]:
        if "superadmin" in user.roles or "director" in user.roles:
            target_center = center_id
        elif "admin" in user.roles:
            user_row = await self._user_row(user)
            if not user_row.center_id:
                return []
            target_center = str(user_row.center_id)
        else:
            raise HTTPException(status_code=403, detail="Нет прав на просмотр назначений")

        coaches, _ = await self.coach_repo.list(center_id=target_center)
        result: list[CoachTierOut] = []
        for coach in coaches:
            result.append(
                CoachTierOut(
                    coach_id=str(coach.id),
                    user_id=str(coach.user_id),
                    coach_name=await self._coach_name(str(coach.id)),
                    specialization=coach.specialization,
                    tier=coach.incentive_tier,
                    updated_at=coach.updated_at,
                ),
            )
        return result

    async def set_coach_tier(
        self, coach_id: str, data: CoachTierUpdate, user: CurrentUser,
    ) -> CoachTierOut:
        found, _ = await self.coach_repo.list(id=coach_id)
        if not found:
            raise HTTPException(status_code=404, detail="Тренер не найден")
        coach = found[0]
        await self._check_tier_manage_rights(user, coach)
        coach.incentive_tier = data.tier
        await self.coach_repo.session.flush()
        await self.coach_repo.session.refresh(coach)
        return CoachTierOut(
            coach_id=str(coach.id),
            user_id=str(coach.user_id),
            coach_name=await self._coach_name(str(coach.id)),
            specialization=coach.specialization,
            tier=coach.incentive_tier,
            updated_at=coach.updated_at,
        )

    async def create_plan(self, data: EventPlanCreate, user: CurrentUser):
        if "superadmin" in user.roles:
            coach_id = data.coach_id
            center_id = data.center_id
            if not coach_id or not center_id:
                raise HTTPException(
                    status_code=422, detail="coach_id and center_id are required",
                )
        elif "coach" in user.roles:
            coach = await self._own_coach_or_403(user)
            coach_id = str(coach.id)
            center_id = str(coach.center_id) if coach.center_id else None
            if not center_id:
                raise HTTPException(
                    status_code=422, detail="У тренера не указан центр",
                )
        else:
            raise HTTPException(
                status_code=403, detail="План может создавать только тренер",
            )

        existing, _ = await self.plan_repo.list(coach_id=coach_id, year=data.year)
        if existing:
            return await self._enrich_plan(existing[0])

        program_id = data.program_id
        if not program_id:
            programs, _ = await self.program_repo.list(status="active")
            program_id = str(programs[0].id) if programs else None

        plan = await self.plan_repo.create(
            coach_id=coach_id, center_id=center_id, program_id=program_id,
            year=data.year, status="draft",
        )
        return await self._enrich_plan(plan)

    async def list_plans(
        self,
        user: CurrentUser,
        center_id: str | None = None,
        year: int | None = None,
    ) -> list[EventPlanOut]:
        filters: dict = {}
        if center_id:
            filters["center_id"] = center_id
        if year:
            filters["year"] = year

        if "coach" in user.roles and "superadmin" not in user.roles:
            coach = await self._coach_of(user)
            if not coach:
                return []
            filters["coach_id"] = str(coach.id)
        elif "admin" in user.roles and not user.has_any_role("director", "superadmin"):
            user_row = await self._user_row(user)
            if not user_row.center_id:
                return []
            filters["center_id"] = str(user_row.center_id)

        plans, _ = await self.plan_repo.list(**filters)
        return [await self._enrich_plan(plan) for plan in plans]

    async def _check_plan_access(self, plan: EventPlan, user: CurrentUser) -> None:
        if "superadmin" in user.roles or "director" in user.roles:
            return
        if "coach" in user.roles:
            coach = await self._coach_of(user)
            if coach and str(coach.id) == str(plan.coach_id):
                return
        if "admin" in user.roles:
            user_row = await self._user_row(user)
            if user_row.center_id and str(user_row.center_id) == str(plan.center_id):
                return
        raise HTTPException(status_code=403, detail="Нет доступа к плану")

    async def get_plan(self, id: str, user: CurrentUser) -> EventPlanOut:
        plan = await self._get_plan_or_404(id)
        await self._check_plan_access(plan, user)
        return await self._enrich_plan(plan)

    async def update_plan(
        self, plan_id: str, data: EventPlanUpdate, user: CurrentUser,
    ) -> EventPlanOut:
        plan = await self._get_plan_or_404(plan_id)
        if "superadmin" in user.roles:
            pass
        elif "coach" in user.roles:
            coach = await self._own_coach_or_403(user)
            if str(coach.id) != str(plan.coach_id):
                raise HTTPException(status_code=403, detail="Нет доступа к плану")
            items = await self._plan_items(str(plan.id))
            if aggregate_plan_status(items) != "draft":
                raise HTTPException(
                    status_code=422,
                    detail="Обновить план можно только в статусе «черновик»",
                )
        else:
            raise HTTPException(status_code=403, detail="Нет доступа к плану")

        payload = data.model_dump(exclude_unset=True)
        if "coach" in user.roles and "superadmin" not in user.roles:
            payload.pop("coach_id", None)
            payload.pop("center_id", None)
        if not payload:
            raise HTTPException(status_code=422, detail="Nothing to update")
        for key, value in payload.items():
            setattr(plan, key, value)
        await self.plan_repo.session.flush()
        return await self._enrich_plan(plan)

    async def delete_plan(self, plan_id: str, user: CurrentUser) -> dict:
        plan = await self._get_plan_or_404(plan_id)
        user_row = await self._user_row(user)
        if not self._can_review(user, plan, user_row):
            raise HTTPException(
                status_code=403,
                detail="Удалить план целиком может только руководитель",
            )
        await self.plan_repo.delete(str(plan.id))
        return {"ok": True}

    async def add_plan_item(
        self, plan_id: str, data: PlanItemCreate, user: CurrentUser,
    ) -> PlanItemOut:
        plan = await self._get_plan_or_404(plan_id)
        await self._check_plan_access(plan, user)
        if "coach" in user.roles and "superadmin" not in user.roles:
            await self._own_coach_or_403(user)
        item = await self.item_repo.create(plan_id=plan_id, **data.model_dump())
        return PlanItemOut.model_validate(item)

    async def list_plan_items(self, plan_id: str, user: CurrentUser) -> list[PlanItemOut]:
        plan = await self._get_plan_or_404(plan_id)
        await self._check_plan_access(plan, user)
        items = await self._plan_items(plan_id)
        return [PlanItemOut.model_validate(item) for item in items]

    async def _plan_of_item(self, item_id: str) -> tuple[PlanItem, EventPlan]:
        item = await self.item_repo.get(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        plan = await self._get_plan_or_404(str(item.plan_id))
        return item, plan

    async def _owner_guard(self, item: PlanItem, plan: EventPlan, user: CurrentUser) -> None:
        if "superadmin" in user.roles:
            return
        coach = await self._own_coach_or_403(user)
        if str(coach.id) != str(plan.coach_id):
            raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")

    async def _refresh_plan_status(self, plan: EventPlan) -> None:
        items = await self._plan_items(str(plan.id))
        plan.status = aggregate_plan_status(items)

    async def update_plan_item(
        self, item_id: str, data: PlanItemUpdate, user: CurrentUser,
    ) -> PlanItemOut:
        item, plan = await self._plan_of_item(item_id)
        await self._owner_guard(item, plan, user)
        if not ("superadmin" in user.roles or user.has_any_role("coach")):
            raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")
        if "superadmin" not in user.roles:
            self._require_item_draft(item)
        payload = data.model_dump(exclude_unset=True)
        if not payload:
            raise HTTPException(status_code=422, detail="Nothing to update")
        for key, value in payload.items():
            setattr(item, key, value)
        await self.item_repo.session.flush()
        return PlanItemOut.model_validate(item)

    async def delete_plan_item(self, item_id: str, user: CurrentUser) -> dict:
        item, plan = await self._plan_of_item(item_id)
        await self._owner_guard(item, plan, user)
        if not ("superadmin" in user.roles or user.has_any_role("coach")):
            raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")
        if "superadmin" not in user.roles:
            self._require_item_draft(item)
        await self.item_repo.delete(item_id)
        await self._refresh_plan_status(plan)
        return {"ok": True}

    async def submit_plan_item(self, item_id: str, user: CurrentUser) -> PlanItemOut:
        item, plan = await self._plan_of_item(item_id)
        await self._owner_guard(item, plan, user)
        if "superadmin" not in user.roles:
            if not user.has_any_role("coach"):
                raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")
            self._require_item_draft(item, "На проверку можно отправить только черновик")
        item.status = "submitted"
        item.submitted_at = datetime.now(_UTC)
        await self._refresh_plan_status(plan)
        return PlanItemOut.model_validate(item)

    async def redraft_plan_item(self, item_id: str, user: CurrentUser) -> PlanItemOut:
        item, plan = await self._plan_of_item(item_id)
        await self._owner_guard(item, plan, user)
        if "superadmin" not in user.roles:
            if not user.has_any_role("coach"):
                raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")
            if item.status != "rejected":
                raise HTTPException(
                status_code=422, detail="Вернуть в черновик можно только отклонённое",
            )
        item.status = "draft"
        item.submitted_at = None
        item.reviewed_at = None
        item.reviewer_id = None
        item.reviewer_comment = None
        await self._refresh_plan_status(plan)
        return PlanItemOut.model_validate(item)

    async def _review_item(
        self, item_id: str, user: CurrentUser, comment: str | None, action: str,
    ) -> PlanItemOut:
        item, plan = await self._plan_of_item(item_id)
        if not await self._is_reviewer(user):
            raise HTTPException(status_code=403, detail="Нет прав на проверку")
        user_row = await self._user_row(user)
        if not self._can_review(user, plan, user_row):
            raise HTTPException(status_code=403, detail="Нет доступа к плану этого центра")
        if item.status != "submitted":
            raise HTTPException(
                status_code=422,
                detail="Проверить можно только мероприятие в статусе «на проверке»",
            )
        if action == "reject" and not (comment or "").strip():
            raise HTTPException(status_code=422, detail="Комментарий обязателен")
        item.status = "approved" if action == "approve" else "rejected"
        item.reviewed_at = datetime.now(_UTC)
        item.reviewer_id = user.id
        if action == "reject":
            item.reviewer_comment = (comment or "").strip()
        await self._refresh_plan_status(plan)
        return PlanItemOut.model_validate(item)

    async def approve_plan_item(self, item_id: str, user: CurrentUser) -> PlanItemOut:
        return await self._review_item(item_id, user, None, "approve")

    async def reject_plan_item(
        self, item_id: str, comment: str, user: CurrentUser,
    ) -> PlanItemOut:
        return await self._review_item(item_id, user, comment, "reject")

    async def _get_protocol_or_404(self, protocol_id: str) -> CommissionProtocol:
        protocol = await self.protocol_repo.get(protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Протокол не найден")
        return protocol

    def _require_protocol_draft(self, protocol: CommissionProtocol) -> None:
        if protocol.status != "draft":
            raise HTTPException(
                status_code=422, detail="Изменять или удалять можно только черновик",
            )

    async def _coach_name(self, coach_id: str) -> str:
        coaches, _ = await self.coach_repo.list(id=coach_id)
        if not coaches:
            return ""
        coach = coaches[0]
        result = await self.plan_repo.session.execute(
            select(User).where(User.id == coach.user_id),
        )
        user = result.scalar_one_or_none()
        if not user:
            return ""
        return f"{user.last_name} {user.first_name}" + (
            f" {user.middle_name}" if user.middle_name else ""
        )

    async def _enrich_protocol(self, protocol: CommissionProtocol) -> CommissionProtocolOut:
        payload = {
            "id": protocol.id,
            "number": protocol.number,
            "date": protocol.date,
            "beneficiary_name": protocol.beneficiary_name,
            "period": protocol.period,
            "center_id": protocol.center_id,
            "agenda": protocol.agenda,
            "decisions": protocol.decisions,
            "voting_for": protocol.voting_for,
            "voting_against": protocol.voting_against,
            "voting_abstained": protocol.voting_abstained,
            "status": protocol.status,
            "reviewer_id": protocol.reviewer_id,
            "review_comment": protocol.review_comment,
            "reviewed_at": protocol.reviewed_at,
            "created_at": protocol.created_at,
        }
        out = CommissionProtocolOut.model_validate(payload)
        out.center_name = await self._center_name(str(protocol.center_id))
        rows, _ = await self.payout_repo.list(protocol_id=str(protocol.id))
        enriched: list[PayoutRowOut] = []
        for row in rows:
            payout_out = PayoutRowOut.model_validate(row)
            payout_out.coach_name = await self._coach_name(str(row.coach_id))
            enriched.append(payout_out)
        out.payout_rows = enriched
        return out

    async def create_protocol(
        self, data: CommissionProtocolCreate, user: CurrentUser,
    ):
        if "admin" in user.roles and "superadmin" not in user.roles:
            user_row = await self._user_row(user)
            if not user_row.center_id:
                raise HTTPException(
                    status_code=403,
                    detail="Администратор не привязан к центру",
                )
            if str(user_row.center_id) != str(data.center_id):
                raise HTTPException(
                    status_code=403,
                    detail="Администратор может создавать протоколы только своего центра",
                )
        return await self._enrich_protocol(
            await self.protocol_repo.create(**data.model_dump()),
        )

    async def list_protocols(
        self, center_id: str | None = None, user: CurrentUser | None = None,
    ):
        filters = {}
        if center_id:
            filters["center_id"] = center_id
        elif user and "admin" in user.roles and "superadmin" not in user.roles:
            user_row = await self._user_row(user)
            if not user_row.center_id:
                return []
            filters["center_id"] = str(user_row.center_id)
        protocols, _ = await self.protocol_repo.list(**filters)
        return [await self._enrich_protocol(protocol) for protocol in protocols]

    async def get_protocol(self, id: str):
        protocol = await self._get_protocol_or_404(id)
        return await self._enrich_protocol(protocol)

    async def update_protocol(self, protocol_id: str, data: CommissionProtocolUpdate):
        protocol = await self._get_protocol_or_404(protocol_id)
        self._require_protocol_draft(protocol)
        payload = data.model_dump(exclude_unset=True)
        if not payload:
            raise HTTPException(status_code=422, detail="Nothing to update")
        for key, value in payload.items():
            setattr(protocol, key, value)
        await self.protocol_repo.session.flush()
        return await self._enrich_protocol(protocol)

    async def delete_protocol(self, protocol_id: str) -> dict:
        protocol = await self._get_protocol_or_404(protocol_id)
        self._require_protocol_draft(protocol)
        await self.protocol_repo.delete(str(protocol.id))
        return {"ok": True}

    async def review_protocol(
        self, protocol_id: str, user: CurrentUser, comment: str | None, action: str,
    ) -> CommissionProtocolOut:
        protocol = await self._get_protocol_or_404(protocol_id)
        if protocol.status != "draft":
            raise HTTPException(
                status_code=422, detail="Проверить можно только черновик протокола",
            )
        if action == "reject" and not (comment or "").strip():
            raise HTTPException(status_code=422, detail="Комментарий обязателен")
        protocol.status = "approved" if action == "approve" else "rejected"
        protocol.reviewer_id = user.id
        protocol.reviewed_at = datetime.now(_UTC)
        if action == "reject":
            protocol.review_comment = (comment or "").strip()
        await self.protocol_repo.session.flush()
        return await self._enrich_protocol(protocol)

    async def approve_protocol(
        self, protocol_id: str, user: CurrentUser,
    ) -> CommissionProtocolOut:
        return await self.review_protocol(protocol_id, user, None, "approve")

    async def reject_protocol(
        self, protocol_id: str, comment: str, user: CurrentUser,
    ) -> CommissionProtocolOut:
        return await self.review_protocol(protocol_id, user, comment, "reject")

    async def add_payout_row(self, protocol_id: str, data: PayoutRowCreate):
        protocol = await self._get_protocol_or_404(protocol_id)
        self._require_protocol_draft(protocol)
        ndfl_rate = DEFAULT_NDFL_RATE
        insurance_rate = DEFAULT_INSURANCE_RATE
        min_payout, max_payout = DEFAULT_MIN_PAYOUT, DEFAULT_MAX_PAYOUT
        programs, _ = await self.program_repo.list()
        for program in programs:
            if getattr(program, "status", "active") == "active":
                ndfl_rate = program.ndfl_rate
                insurance_rate = program.insurance_rate
                min_payout, max_payout = program.min_payout, program.max_payout
                break
        try:
            breakdown = breakdown_from_gross(data.gross_amount, ndfl_rate, insurance_rate)
            validate_tier(breakdown.net_amount, min_payout, max_payout)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        payload = data.model_dump()
        payload["ndfl_amount"] = breakdown.ndfl_amount
        payload["insurance_amount"] = breakdown.insurance_amount
        payload["net_amount"] = breakdown.net_amount
        row = await self.payout_repo.create(protocol_id=protocol_id, **payload)
        out = PayoutRowOut.model_validate(row)
        out.coach_name = await self._coach_name(str(row.coach_id))
        return out

    async def list_payout_rows(self, protocol_id: str):
        await self._get_protocol_or_404(protocol_id)
        rows, _ = await self.payout_repo.list(protocol_id=protocol_id)
        result: list[PayoutRowOut] = []
        for row in rows:
            out = PayoutRowOut.model_validate(row)
            out.coach_name = await self._coach_name(str(row.coach_id))
            result.append(out)
        return result

    async def delete_payout_row(self, payout_id: str) -> dict:
        row = await self.payout_repo.get(payout_id)
        if not row:
            raise HTTPException(status_code=404, detail="Строка выплаты не найдена")
        protocol = await self._get_protocol_or_404(str(row.protocol_id))
        self._require_protocol_draft(protocol)
        await self.payout_repo.delete(payout_id)
        return {"ok": True}
