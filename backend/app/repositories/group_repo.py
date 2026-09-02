from sqlalchemy import delete, select

from app.models.group import Group, GroupMember
from app.repositories.base import BaseRepository


class GroupRepository(BaseRepository[Group]):
    def __init__(self, session):
        super().__init__(session, Group)


class GroupMemberRepository(BaseRepository[GroupMember]):
    def __init__(self, session):
        super().__init__(session, GroupMember)

    async def find(self, group_id, athlete_id) -> GroupMember | None:
        stmt = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.athlete_id == athlete_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def remove(self, group_id, athlete_id) -> bool:
        stmt = delete(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.athlete_id == athlete_id,
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def remove_all_for_athlete(self, athlete_id) -> int:
        stmt = delete(GroupMember).where(GroupMember.athlete_id == athlete_id)
        result = await self.session.execute(stmt)
        return result.rowcount or 0

    async def list_for_groups(self, group_ids) -> list[GroupMember]:
        if not group_ids:
            return []
        result = await self.session.execute(
            select(GroupMember).where(GroupMember.group_id.in_(set(group_ids)))
        )
        return list(result.scalars().all())
