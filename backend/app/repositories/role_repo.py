from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Role


class RoleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_code(self, code: str) -> Role | None:
        stmt = select(Role).where(Role.code == code)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self) -> list[Role]:
        stmt = select(Role).order_by(Role.code)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self, code: str, name: str, description: str | None = None,
        is_system: bool = False,
    ) -> Role:
        role = Role(code=code, name=name, description=description, is_system=is_system)
        self.session.add(role)
        await self.session.flush()
        return role

    async def rename(self, code: str, name: str) -> Role | None:
        role = await self.get_by_code(code)
        if not role:
            return None
        role.name = name
        await self.session.flush()
        return role

    async def delete(self, code: str) -> bool:
        role = await self.get_by_code(code)
        if not role:
            return False
        await self.session.delete(role)
        await self.session.flush()
        return True
