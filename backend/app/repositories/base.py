from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository[T]:
    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        self.session = session
        self.model = model

    async def create(self, **kwargs) -> T:
        data = dict(kwargs)
        if hasattr(self.model, "id"):
            data.setdefault("id", str(uuid4()))
        instance = self.model(**data)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def get(self, id: str) -> T | None:
        stmt = select(self.model).where(self.model.id == id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self, page: int = 1, per_page: int = 50, **filters
    ) -> tuple[list[T], int]:
        stmt = select(self.model)
        for attr, value in filters.items():
            if value is not None:
                column = getattr(self.model, attr, None)
                if column is not None:
                    stmt = stmt.where(column == value)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def update(self, id: str, **kwargs) -> T | None:
        instance = await self.get(id)
        if not instance:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(instance, key, value)
        await self.session.flush()
        return instance

    async def delete(self, id: str) -> bool:
        stmt = delete(self.model).where(self.model.id == id)
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def delete_by(self, **filters) -> bool:
        stmt = delete(self.model)
        for attr, value in filters.items():
            if value is not None:
                stmt = stmt.where(getattr(self.model, attr) == value)
        result = await self.session.execute(stmt)
        return result.rowcount > 0
