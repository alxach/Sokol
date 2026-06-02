from app.repositories import GroupMemberRepository, GroupRepository
from app.schemas.group import GroupCreate, GroupMemberAdd


class GroupService:
    def __init__(self, group_repo: GroupRepository, member_repo: GroupMemberRepository) -> None:
        self.group_repo = group_repo
        self.member_repo = member_repo

    async def create(self, data: GroupCreate):
        return await self.group_repo.create(**data.model_dump())

    async def get(self, group_id: str):
        return await self.group_repo.get(group_id)

    async def list(self, page: int = 1, per_page: int = 50, center_id: str | None = None):
        return await self.group_repo.list(page=page, per_page=per_page, center_id=center_id)

    async def add_member(self, group_id: str, data: GroupMemberAdd):
        return await self.member_repo.create(group_id=group_id, **data.model_dump())

    async def remove_member(self, member_id: str):
        return await self.member_repo.delete(member_id)
