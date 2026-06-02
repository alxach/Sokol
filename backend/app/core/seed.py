from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Permission, Role

ROLES = [
    {"code": "superadmin", "name": "Супер-администратор",
     "description": "Полный доступ ко всей системе", "is_system": True},
    {"code": "director", "name": "Руководитель",
     "description": "Руководитель всех центров", "is_system": True},
    {"code": "admin", "name": "Администратор",
     "description": "Администратор своего центра", "is_system": True},
    {"code": "coach", "name": "Тренер",
     "description": "Тренерский состав", "is_system": True},
    {"code": "methodist", "name": "Методист",
     "description": "Шаблоны отчётов, аналитика качества", "is_system": True},
    {"code": "viewer", "name": "Наблюдатель",
     "description": "Только чтение", "is_system": True},
]

RESOURCES = ["athletes", "coaches", "groups", "schedules", "attendance",
             "reports", "events", "competitions", "documents", "users", "centers", "regions"]
ACTIONS = ["create", "read", "update", "delete", "approve"]


async def seed_roles_and_permissions(db: AsyncSession) -> None:
    existing = await db.execute(select(Role).limit(1))
    if existing.scalar_one_or_none():
        return

    for role_data in ROLES:
        role = Role(**role_data)
        db.add(role)
    await db.flush()

    for resource in RESOURCES:
        for action in ACTIONS:
            perm = Permission(
                code=f"{resource}.{action}",
                name=f"{action.capitalize()} {resource}",
                resource=resource,
                action=action,
            )
            db.add(perm)
    await db.flush()
