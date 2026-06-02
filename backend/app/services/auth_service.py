import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import Role, User, UserRole
from app.repositories.role_repo import RoleRepository
from app.repositories.user_repo import UserRepository


async def _get_user_roles(session: AsyncSession, user_id: uuid.UUID) -> list[str]:
    stmt = (
        select(Role.code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.role_repo = RoleRepository(session)

    async def login(self, email: str, password: str) -> dict:
        user = await self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )
        roles = await _get_user_roles(self.session, user.id)
        return self._build_token_response(user, roles)

    async def register(self, email: str, phone: str, password: str,
                       first_name: str, last_name: str,
                       middle_name: str | None = None) -> dict:
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user = User(
            email=email,
            phone=phone,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            middle_name=middle_name,
        )
        user = await self.user_repo.create(user)

        coach_role = await self.role_repo.get_by_code("coach")
        if coach_role:
            await self.user_repo.add_role(user.id, coach_role.id)

        roles = await _get_user_roles(self.session, user.id)
        return self._build_token_response(user, roles)

    async def refresh(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token)
        sub = payload.get("sub")
        if not sub or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        user = await self.user_repo.get_by_id(uuid.UUID(sub))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )
        roles = await _get_user_roles(self.session, user.id)
        return self._build_token_response(user, roles)

    async def get_me(self, user_id: str) -> dict:
        user = await self.user_repo.get_by_id(uuid.UUID(user_id))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        roles = await _get_user_roles(self.session, user.id)
        return {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "middle_name": user.middle_name,
            "avatar_url": user.avatar_url,
            "is_active": user.is_active,
            "roles": roles,
        }

    def _build_token_response(self, user: User, roles: list[str]) -> dict:
        return {
            "access_token": create_access_token(str(user.id), roles),
            "refresh_token": create_refresh_token(str(user.id)),
            "token_type": "Bearer",
            "expires_in": 1800,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "roles": roles,
                "center_id": None,
            },
        }
