from fastapi import APIRouter, Depends

from app.core.dependencies import require_roles
from app.dependencies import get_incentive_service
from app.schemas.incentive import (
    CommissionProtocolCreate,
    EventPlanCreate,
    PayoutRowCreate,
    PlanItemCreate,
)
from app.services.incentive_service import IncentiveService

router = APIRouter(
    prefix="/incentive",
    tags=["incentive"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


@router.get("/programs")
async def list_programs(service: IncentiveService = Depends(get_incentive_service)):
    return await service.list_programs()


@router.get("/programs/{program_id}")
async def get_program(program_id: str, service: IncentiveService = Depends(get_incentive_service)):
    return await service.get_program(program_id)


@router.post("/plans")
async def create_plan(
    data: EventPlanCreate,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.create_plan(data)


@router.get("/plans")
async def list_plans(
    coach_id: str | None = None,
    center_id: str | None = None,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.list_plans(coach_id=coach_id, center_id=center_id)


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str, service: IncentiveService = Depends(get_incentive_service)):
    return await service.get_plan(plan_id)


@router.post(
    "/plans/{plan_id}/items"
)
async def add_plan_item(
    plan_id: str,
    data: PlanItemCreate,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.add_plan_item(plan_id, data)


@router.get("/plans/{plan_id}/items")
async def list_plan_items(plan_id: str, service: IncentiveService = Depends(get_incentive_service)):
    return await service.list_plan_items(plan_id)


@router.post("/protocols", dependencies=[Depends(require_roles("admin", "director"))])
async def create_protocol(
    data: CommissionProtocolCreate,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.create_protocol(data)


@router.get("/protocols", dependencies=[Depends(require_roles("admin", "director"))])
async def list_protocols(
    center_id: str | None = None,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.list_protocols(center_id=center_id)


@router.get("/protocols/{protocol_id}", dependencies=[Depends(require_roles("admin", "director"))])
async def get_protocol(
    protocol_id: str,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.get_protocol(protocol_id)


@router.post(
    "/protocols/{protocol_id}/payouts",
    dependencies=[Depends(require_roles("admin", "director"))],
)
async def add_payout_row(
    protocol_id: str,
    data: PayoutRowCreate,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.add_payout_row(protocol_id, data)


@router.get(
    "/protocols/{protocol_id}/payouts",
    dependencies=[Depends(require_roles("admin", "director"))],
)
async def list_payout_rows(
    protocol_id: str,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.list_payout_rows(protocol_id)
