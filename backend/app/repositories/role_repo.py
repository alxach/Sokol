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
