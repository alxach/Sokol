from fastapi import HTTPException

from app.repositories import (
    CommissionProtocolRepository,
    EventPlanRepository,
    IncentiveProgramRepository,
    PayoutRowRepository,
    PlanItemRepository,
)
from app.schemas.incentive import (
    CommissionProtocolCreate,
    EventPlanCreate,
    PayoutRowCreate,
    PlanItemCreate,
)
from app.services.incentive_calc import breakdown_from_gross, validate_tier

DEFAULT_NDFL_RATE = 13.0
DEFAULT_INSURANCE_RATE = 30.2
DEFAULT_MIN_PAYOUT = 25000
DEFAULT_MAX_PAYOUT = 50000


class IncentiveService:
    def __init__(
        self,
        program_repo: IncentiveProgramRepository,
        plan_repo: EventPlanRepository,
        item_repo: PlanItemRepository,
        protocol_repo: CommissionProtocolRepository,
        payout_repo: PayoutRowRepository,
    ) -> None:
        self.program_repo = program_repo
        self.plan_repo = plan_repo
        self.item_repo = item_repo
        self.protocol_repo = protocol_repo
        self.payout_repo = payout_repo

    async def list_programs(self):
        programs, _ = await self.program_repo.list()
        return programs

    async def get_program(self, id: str):
        return await self.program_repo.get(id)

    async def create_plan(self, data: EventPlanCreate):
        return await self.plan_repo.create(**data.model_dump())

    async def list_plans(self, coach_id: str | None = None, center_id: str | None = None):
        filters = {}
        if coach_id:
            filters["coach_id"] = coach_id
        if center_id:
            filters["center_id"] = center_id
        plans, _ = await self.plan_repo.list(**filters)
        return plans

    async def get_plan(self, id: str):
        return await self.plan_repo.get(id)

    async def add_plan_item(self, plan_id: str, data: PlanItemCreate):
        return await self.item_repo.create(plan_id=plan_id, **data.model_dump())

    async def list_plan_items(self, plan_id: str):
        items, _ = await self.item_repo.list(plan_id=plan_id)
        return items

    async def create_protocol(self, data: CommissionProtocolCreate):
        return await self.protocol_repo.create(**data.model_dump())

    async def list_protocols(self, center_id: str | None = None):
        filters = {}
        if center_id:
            filters["center_id"] = center_id
        protocols, _ = await self.protocol_repo.list(**filters)
        return protocols

    async def get_protocol(self, id: str):
        return await self.protocol_repo.get(id)

    async def add_payout_row(self, protocol_id: str, data: PayoutRowCreate):
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
        return await self.payout_repo.create(protocol_id=protocol_id, **payload)

    async def list_payout_rows(self, protocol_id: str):
        rows, _ = await self.payout_repo.list(protocol_id=protocol_id)
        return rows
