import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.core.security import hash_password
from app.database import get_db
from app.models.user import User, UserRole
from app.repositories.role_repo import RoleRepository
from app.repositories.user_repo import UserRepository
from app.schemas.user_admin import (
    ResetPasswordResponse,
    RoleCreateRequest,
    RoleOut,
    RoleUpdateRequest,
    UserAssignRolesRequest,
    UserCreateRequest,
    UserListResponse,
    UserOut,
    UserUpdateRequest,
)

router = APIRouter(
    prefix="/users",
    tags=["users-admin"],
    dependencies=[Depends(require_roles("superadmin"))],
)


def _user_to_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        phone=user.phone,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        center_id=str(user.center_id) if user.center_id else None,
        roles=[
            RoleOut(
                id=str(ur.role.id), code=ur.role.code,
                name=ur.role.name, is_system=ur.role.is_system,
            )
            for ur in user.roles
        ],
        created_at=user.created_at.isoformat(),
    )


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
    center_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    cid = uuid.UUID(center_id) if center_id else None
    users, total = await repo.list_users(
        page=page, per_page=per_page, search=search,
        role_code=role, is_active=is_active, center_id=cid,
    )
    return UserListResponse(
        data=[_user_to_out(u) for u in users],
        meta={"page": page, "per_page": per_page, "total": total},
    )


@router.get("/roles")
async def list_roles(db: AsyncSession = Depends(get_db)):
    repo = RoleRepository(db)
    roles = await repo.list_all()
    return {
        "data": [
            RoleOut(id=str(r.id), code=r.code, name=r.name, is_system=r.is_system)
            for r in roles
        ],
    }


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(body: RoleCreateRequest, db: AsyncSession = Depends(get_db)):
    repo = RoleRepository(db)
    if await repo.get_by_code(body.code):
        raise HTTPException(status_code=409, detail="Role code already exists")
    role = await repo.create(body.code, body.name)
    return RoleOut(id=str(role.id), code=role.code, name=role.name)


@router.patch("/roles/{code}", response_model=RoleOut)
async def update_role(code: str, body: RoleUpdateRequest, db: AsyncSession = Depends(get_db)):
    repo = RoleRepository(db)
    if not body.name:
        raise HTTPException(status_code=400, detail="Nothing to update")
    role = await repo.rename(code, body.name)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleOut(id=str(role.id), code=role.code, name=role.name)


@router.delete("/roles/{code}")
async def delete_role(code: str, db: AsyncSession = Depends(get_db)):
    repo = RoleRepository(db)
    role = await repo.get_by_code(code)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=409, detail="System role cannot be deleted")
    usage = (
        await db.execute(
            select(func.count()).select_from(UserRole).where(UserRole.role_id == role.id)
        )
    ).scalar()
    if usage:
        raise HTTPException(status_code=409, detail="Role is assigned to users")
    await repo.delete(code)
    return {"detail": "Role deleted"}


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreateRequest, db: AsyncSession = Depends(get_db)):
    user_repo = UserRepository(db)
    existing = await user_repo.get_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        middle_name=body.middle_name,
        center_id=uuid.UUID(body.center_id) if body.center_id else None,
    )
    user = await user_repo.create(user)
    await user_repo.set_roles(user.id, body.role_codes)

    user = await user_repo.get_by_id(user.id)
    return _user_to_out(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_out(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: str, body: UserUpdateRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    fields = body.model_dump(exclude_unset=True)
    if "center_id" in fields:
        fields["center_id"] = uuid.UUID(fields["center_id"]) if fields["center_id"] else None
    user = await repo.update(uuid.UUID(user_id), **fields)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user = await repo.get_by_id(uuid.UUID(user_id))
    return _user_to_out(user)


@router.patch("/{user_id}", response_model=UserOut)
async def patch_user(user_id: str, body: UserUpdateRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "center_id" in fields:
        fields["center_id"] = uuid.UUID(fields["center_id"]) if fields["center_id"] else None
    user = await repo.update(uuid.UUID(user_id), **fields)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user = await repo.get_by_id(uuid.UUID(user_id))
    return _user_to_out(user)


@router.post("/{user_id}/roles", response_model=UserOut)
async def assign_roles(
    user_id: str, body: UserAssignRolesRequest, db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await repo.set_roles(uuid.UUID(user_id), body.role_codes)
    user = await repo.get_by_id(uuid.UUID(user_id))
    return _user_to_out(user)


@router.delete("/{user_id}")
async def deactivate_user(user_id: str, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    ok = await repo.soft_delete(uuid.UUID(user_id))
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return {"detail": "User deactivated"}


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(user_id: str, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    temporary_password = secrets.token_urlsafe(8)
    user.password_hash = hash_password(temporary_password)
    await db.flush()
    return ResetPasswordResponse(
        user_id=str(user.id), temporary_password=temporary_password,
    )
