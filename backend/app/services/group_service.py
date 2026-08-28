from datetime import date

from sqlalchemy import select

from app.models import Center, Coach, User
from app.repositories import GroupMemberRepository, GroupRepository
from app.schemas.group import GroupCreate, GroupMemberAdd, GroupResponse, GroupUpdate


class GroupService:
    def __init__(self, group_repo: GroupRepository, member_repo: GroupMemberRepository) -> None:
        self.group_repo = group_repo
        self.member_repo = member_repo

    async def create(self, data: GroupCreate) -> GroupResponse:
        group = await self.group_repo.create(**data.model_dump())
        return await self.to_response(group)

    async def get(self, group_id: str) -> GroupResponse | None:
        instance = await self.group_repo.get(group_id)
        if not instance:
            return None
        return await self.to_response(instance)

    async def list(
        self, page: int = 1, per_page: int = 50, center_id: str | None = None,
    ) -> tuple[list[GroupResponse], int]:
        items, total = await self.group_repo.list(
            page=page, per_page=per_page, center_id=center_id,
        )
        return [await self.to_response(g) for g in items], total

    async def update(self, group_id: str, data: GroupUpdate) -> GroupResponse | None:
        instance = await self.group_repo.get(group_id)
        if not instance:
            return None
        for key, value in data.model_dump().items():
            if key in data.model_fields_set:
                setattr(instance, key, value)
        await self.group_repo.session.flush()
        return await self.to_response(instance)

    async def delete(self, group_id: str) -> bool:
        return await self.group_repo.delete(group_id)

    async def add_member(self, group_id: str, data: GroupMemberAdd):
        existing = await self.member_repo.find(group_id, data.athlete_id)
        if existing:
            return None
        join_date = data.join_date or date.today()
        return await self.member_repo.create(
            group_id=group_id, athlete_id=data.athlete_id, join_date=join_date,
        )

    async def remove_member(self, group_id: str, athlete_id: str) -> bool:
        return await self.member_repo.remove(group_id, athlete_id)

    async def to_response(self, group) -> GroupResponse:
        response = GroupResponse.model_validate(group)
        coach_ids = [group.coach_id] if group.coach_id else []
        center_ids = [group.center_id] if group.center_id else []
        coaches = await self._coach_names(coach_ids)
        centers = await self._center_info(center_ids)
        if group.coach_id:
            coach_name, coach_user_id = coaches.get(str(group.coach_id), (None, None))
            response.coach_name = coach_name
            response.coach_user_id = coach_user_id
        if group.center_id:
            response.center_name = centers["names"].get(str(group.center_id))
            response.center_city = centers["cities"].get(str(group.center_id))
        members = await self.member_repo.list_for_groups([group.id])
        response.athlete_ids = sorted(str(m.athlete_id) for m in members)
        response.athlete_count = len(response.athlete_ids)
        return response

    async def _coach_names(
        self, coach_ids: list[str],
    ) -> dict[str, tuple[str | None, str | None]]:
        result: dict[str, tuple[str | None, str | None]] = {}
        if not coach_ids:
            return result
        coaches = (
            await self.group_repo.session.execute(
                select(Coach).where(Coach.id.in_(set(coach_ids)))
            )
        ).scalars().all()
        user_ids = [c.user_id for c in coaches if c.user_id]
        users: dict[str, User] = {}
        if user_ids:
            found = await self.group_repo.session.execute(
                select(User).where(User.id.in_(set(user_ids)))
            )
            users = {u.id: u for u in found.scalars().all()}
        for c in coaches:
            u = users.get(c.user_id)
            if u:
                result[str(c.id)] = (
                    self._full_name(u),
                    str(u.id),
                )
        return result

    async def _center_info(
        self, center_ids: list[str],
    ) -> dict[str, dict[str, str]]:
        names: dict[str, str] = {}
        cities: dict[str, str] = {}
        if not center_ids:
            return {"names": names, "cities": cities}
        centers = (
            await self.group_repo.session.execute(
                select(Center).where(Center.id.in_(set(center_ids)))
            )
        ).scalars().all()
        for c in centers:
            names[str(c.id)] = c.name
            cities[str(c.id)] = c.city or ""
        return {"names": names, "cities": cities}

    @staticmethod
    def _full_name(user: User) -> str:
        return " ".join(
            p for p in (user.last_name, user.first_name, user.middle_name or "") if p
        ) or None
