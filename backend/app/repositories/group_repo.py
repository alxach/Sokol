from app.models.group import Group, GroupMember
from app.repositories.base import BaseRepository


class GroupRepository(BaseRepository[Group]):
    def __init__(self, session):
        super().__init__(session, Group)


class GroupMemberRepository(BaseRepository[GroupMember]):
    def __init__(self, session):
        super().__init__(session, GroupMember)
