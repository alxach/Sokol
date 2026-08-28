from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import require_roles
from app.dependencies import get_group_service
from app.schemas.group import GroupCreate, GroupMemberAdd, GroupUpdate
from app.services.group_service import GroupService

router = APIRouter(
    prefix="/groups",
    tags=["groups"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


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
    result = await service.get(group_id)
    if not result:
        raise HTTPException(404, "Группа не найдена")
    return result


@router.patch("/{group_id}")
async def update_group(
    group_id: str,
    data: GroupUpdate,
    service: GroupService = Depends(get_group_service),
):
    result = await service.update(group_id, data)
    if not result:
        raise HTTPException(404, "Группа не найдена")
    return result


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    service: GroupService = Depends(get_group_service),
):
    if not await service.delete(group_id):
        raise HTTPException(404, "Группа не найдена")
    return {"ok": True}


@router.post("/{group_id}/members")
async def add_member(
    group_id: str,
    data: GroupMemberAdd,
    service: GroupService = Depends(get_group_service),
):
    member = await service.add_member(group_id, data)
    if not member:
        raise HTTPException(409, "Спортсмен уже входит в группу")
    return {"ok": True, "group_id": str(member.group_id), "athlete_id": str(member.athlete_id)}


@router.delete("/{group_id}/members/{athlete_id}")
async def remove_member(
    group_id: str,
    athlete_id: str,
    service: GroupService = Depends(get_group_service),
):
    if not await service.remove_member(group_id, athlete_id):
        raise HTTPException(404, "Участник не найден")
    return {"ok": True}
