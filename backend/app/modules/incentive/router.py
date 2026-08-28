from fastapi import APIRouter, Depends

from app.core.dependencies import CurrentUser, get_current_user, require_roles
from app.dependencies import get_incentive_service
from app.schemas.incentive import (
    CommissionProtocolCreate,
    EventPlanCreate,
    EventPlanUpdate,
    IncentiveCriteriaUpsert,
    IncentiveProgramCreate,
    IncentiveProgramUpdate,
    PayoutRowCreate,
    PlanItemCreate,
    PlanItemReview,
    PlanItemUpdate,
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


@router.post("/programs")
async def create_program(
    data: IncentiveProgramCreate,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.create_program(data)


@router.patch("/programs/{program_id}")
async def update_program(
    program_id: str,
    data: IncentiveProgramUpdate,
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.update_program(program_id, data)


@router.get("/criteria")
async def list_criteria(
    center_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.get_criteria(user, center_id=center_id)


@router.put("/criteria/{center_id}")
async def upsert_criteria(
    center_id: str,
    data: IncentiveCriteriaUpsert,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.upsert_criteria(center_id, data, user)


@router.post("/plans")
async def create_plan(
    data: EventPlanCreate,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.create_plan(data, user)


@router.get("/plans")
async def list_plans(
    center_id: str | None = None,
    year: int | None = None,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.list_plans(user, center_id=center_id, year=year)


@router.get("/plans/{plan_id}")
async def get_plan(
    plan_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.get_plan(plan_id, user)


@router.put("/plans/{plan_id}")
async def update_plan(
    plan_id: str,
    data: EventPlanUpdate,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.update_plan(plan_id, data, user)


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.delete_plan(plan_id, user)


@router.post("/plans/{plan_id}/items")
async def add_plan_item(
    plan_id: str,
    data: PlanItemCreate,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.add_plan_item(plan_id, data, user)


@router.get("/plans/{plan_id}/items")
async def list_plan_items(
    plan_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.list_plan_items(plan_id, user)


@router.put("/plans/items/{item_id}")
async def update_plan_item(
    item_id: str,
    data: PlanItemUpdate,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.update_plan_item(item_id, data, user)


@router.delete("/plans/items/{item_id}")
async def delete_plan_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.delete_plan_item(item_id, user)


@router.post("/plans/items/{item_id}/submit")
async def submit_plan_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.submit_plan_item(item_id, user)


@router.post("/plans/items/{item_id}/redraft")
async def redraft_plan_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.redraft_plan_item(item_id, user)


@router.post(
    "/plans/items/{item_id}/approve",
    dependencies=[Depends(require_roles("admin", "director"))],
)
async def approve_plan_item(
    item_id: str,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.approve_plan_item(item_id, user)


@router.post(
    "/plans/items/{item_id}/reject",
    dependencies=[Depends(require_roles("admin", "director"))],
)
async def reject_plan_item(
    item_id: str,
    body: PlanItemReview,
    user: CurrentUser = Depends(get_current_user),
    service: IncentiveService = Depends(get_incentive_service),
):
    return await service.reject_plan_item(item_id, body.comment, user)


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
