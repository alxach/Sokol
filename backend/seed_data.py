"""Seed database with test data: regions, centers, users with roles.

Idempotent — skips existing data, only adds what's missing.

Usage:
    cd backend
    python -m seed_data
"""
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.database import async_session_factory
from app.models.organization import Center, Region
from app.models.user import Role, User, UserRole


REGIONS = [
    {"name": "Москва", "code": "MOW"},
    {"name": "Санкт-Петербург", "code": "spb"},
    {"name": "Краснодарский край", "code": "krd"},
]

CENTERS = [
    {"name": "ЦСЕ Южный", "city": "Москва", "center_type": "cse", "region": "Москва"},
    {"name": "ЦСЕ Северный", "city": "Санкт-Петербург", "center_type": "cse", "region": "Санкт-Петербург"},
    {"name": "ЦСЕ Кубань", "city": "Краснодар", "center_type": "cse", "region": "Краснодарский край"},
]

USERS = [
    {
        "email": "superadmin@sokol.ru",
        "phone": "+79001000001",
        "password": "admin123",
        "first_name": "Супер",
        "last_name": "Администратор",
        "role_code": "superadmin",
        "center": "ЦСЕ Южный",
    },
    {
        "email": "director@sokol.ru",
        "phone": "+79001000002",
        "password": "admin123",
        "first_name": "Иван",
        "last_name": "Директоров",
        "role_code": "director",
        "center": None,
    },
    {
        "email": "admin@sokol.ru",
        "phone": "+79001000003",
        "password": "admin123",
        "first_name": "Алексей",
        "last_name": "Админов",
        "role_code": "admin",
        "center": "ЦСЕ Южный",
    },
    {
        "email": "coach@sokol.ru",
        "phone": "+79001000004",
        "password": "admin123",
        "first_name": "Мария",
        "last_name": "Тренерова",
        "role_code": "coach",
        "center": "ЦСЕ Южный",
    },
]


async def seed(db: AsyncSession) -> None:
    # Regions
    existing_regions = (await db.execute(select(Region))).scalars().all()
    region_map = {r.code: r for r in existing_regions}
    created_regions = 0
    for r_data in REGIONS:
        if r_data["code"] not in region_map:
            region = Region(**r_data)
            db.add(region)
            await db.flush()
            region_map[r_data["code"]] = region
            created_regions += 1
    print(f"  Regions: {created_regions} created, {len(existing_regions)} existed")

    # Centers
    existing_centers = (await db.execute(select(Center))).scalars().all()
    center_map = {c.name: c for c in existing_centers}
    created_centers = 0
    for c_data in CENTERS:
        if c_data["name"] not in center_map:
            region_code = next((r["code"] for r in REGIONS if r["name"] == c_data["region"]), None)
            center = Center(
                name=c_data["name"],
                city=c_data["city"],
                center_type=c_data["center_type"],
                region_id=region_map[region_code].id if region_code and region_code in region_map else None,
            )
            db.add(center)
            await db.flush()
            center_map[c_data["name"]] = center
            created_centers += 1
    print(f"  Centers: {created_centers} created, {len(existing_centers)} existed")

    # Roles lookup
    roles_result = await db.execute(select(Role))
    roles_by_code = {r.code: r for r in roles_result.scalars().all()}

    # Users
    existing_users = (await db.execute(select(User))).scalars().all()
    existing_emails = {u.email for u in existing_users}
    created_users = 0
    for u_data in USERS:
        if u_data["email"] not in existing_emails:
            user = User(
                email=u_data["email"],
                phone=u_data["phone"],
                password_hash=hash_password(u_data["password"]),
                first_name=u_data["first_name"],
                last_name=u_data["last_name"],
                center_id=center_map[u_data["center"]].id if u_data.get("center") else None,
            )
            db.add(user)
            await db.flush()

            role = roles_by_code.get(u_data["role_code"])
            if role:
                db.add(UserRole(user_id=user.id, role_id=role.id))
                await db.flush()
            created_users += 1
    print(f"  Users: {created_users} created, {len(existing_users)} existed")

    print()
    print("Test credentials (all passwords: admin123):")
    for u in USERS:
        status = "NEW" if u["email"] not in existing_emails else "exists"
        print(f"  {u['email']} ({u['role_code']}) [{status}]")


async def main() -> None:
    async with async_session_factory() as db:
        async with db.begin():
            await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
