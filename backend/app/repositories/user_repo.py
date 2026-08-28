import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import Role, User, UserRole


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        stmt = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        result = await self.session.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        stmt = (
            select(User)
            .options(selectinload(User.roles))
            .where(User.email == email, User.deleted_at.is_(None))
        )
        result = await self.session.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user

    async def add_role(self, user_id: uuid.UUID, role_id: uuid.UUID) -> None:
        self.session.add(UserRole(user_id=user_id, role_id=role_id))
        await self.session.flush()

    async def list_users(
        self,
        *,
        page: int = 1,
        per_page: int = 50,
        search: str | None = None,
        role_code: str | None = None,
        is_active: bool | None = None,
        center_id: uuid.UUID | None = None,
    ) -> tuple[list[User], int]:
        stmt = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.deleted_at.is_(None))
        )

        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                    User.email.ilike(pattern),
                    User.phone.ilike(pattern),
                )
            )

        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)

        if center_id is not None:
            stmt = stmt.where(User.center_id == center_id)

        if role_code:
            role_subq = (
                select(UserRole.user_id)
                .join(Role, Role.id == UserRole.role_id)
                .where(Role.code == role_code)
                .subquery()
            )
            stmt = stmt.where(User.id.in_(select(role_subq.c.user_id)))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0

        offset = (page - 1) * per_page
        result = await self.session.execute(
            stmt.order_by(User.created_at.desc()).offset(offset).limit(per_page)
        )
        users = list(result.unique().scalars().all())

        return users, total

    async def update(self, user_id: uuid.UUID, **fields) -> User | None:
        user = await self.get_by_id(user_id)
        if not user:
            return None
        for key, value in fields.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        await self.session.flush()
        return user

    async def set_roles(self, user_id: uuid.UUID, role_codes: list[str]) -> None:
        user = await self.get_by_id(user_id)
        if not user:
            return
        roles = (await self.session.execute(
            select(Role).where(Role.code.in_(role_codes))
        )).scalars().all()

        user.roles.clear()
        for role in roles:
            user.roles.append(UserRole(user_id=user_id, role_id=role.id))
        await self.session.flush()

    async def soft_delete(self, user_id: uuid.UUID) -> bool:
        user = await self.get_by_id(user_id)
        if not user:
            return False
        user.is_active = False
        user.deleted_at = datetime.now(UTC)
        await self.session.flush()
        return True
