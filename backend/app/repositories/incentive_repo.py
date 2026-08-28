from app.models.commission import CommissionProtocol, PayoutRow
from app.models.event_plan import EventPlan, PlanItem
from app.models.incentive_criteria import IncentiveCriteria
from app.models.incentive_program import IncentiveProgram
from app.repositories.base import BaseRepository


class IncentiveProgramRepository(BaseRepository[IncentiveProgram]):
    def __init__(self, session):
        super().__init__(session, IncentiveProgram)


class IncentiveCriteriaRepository(BaseRepository[IncentiveCriteria]):
    def __init__(self, session):
        super().__init__(session, IncentiveCriteria)

    async def get_by_center(self, center_id: str) -> IncentiveCriteria | None:
        rows, _ = await self.list(center_id=center_id)
        return rows[0] if rows else None


class EventPlanRepository(BaseRepository[EventPlan]):
    def __init__(self, session):
        super().__init__(session, EventPlan)


class PlanItemRepository(BaseRepository[PlanItem]):
    def __init__(self, session):
        super().__init__(session, PlanItem)


class CommissionProtocolRepository(BaseRepository[CommissionProtocol]):
    def __init__(self, session):
        super().__init__(session, CommissionProtocol)


class PayoutRowRepository(BaseRepository[PayoutRow]):
    def __init__(self, session):
        super().__init__(session, PayoutRow)
