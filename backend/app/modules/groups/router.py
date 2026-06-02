from fastapi import APIRouter, Depends

from app.dependencies import get_group_service
from app.schemas.group import GroupCreate, GroupMemberAdd
from app.services.group_service import GroupService

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("")
async def create_group(
    data: GroupCreate,
    service: GroupService = Depends(get_group_service),
):
    return await service.create(data)


@router.get("")
async def list_groups(
    page: int = 1,
    per_page: int = 50,
    center_id: str | None = None,
    service: GroupService = Depends(get_group_service),
):
    return await service.list(page, per_page, center_id)


@router.get("/{group_id}")
async def get_group(
    group_id: str,
    service: GroupService = Depends(get_group_service),
):
    return await service.get(group_id)


@router.post("/{group_id}/members")
async def add_member(
    group_id: str,
    data: GroupMemberAdd,
    service: GroupService = Depends(get_group_service),
):
    return await service.add_member(group_id, data)


@router.delete("/members/{member_id}")
async def remove_member(
    member_id: str,
    service: GroupService = Depends(get_group_service),
):
    return await service.remove_member(member_id)
