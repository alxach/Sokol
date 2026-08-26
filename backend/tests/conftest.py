import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Test environment must be configured before app modules are imported.
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("JWT_SECRET_KEY", "pytest-secret-key-not-for-production")

import app.models  # noqa: E402,F401  - register all tables on Base.metadata
from app.core.base import Base  # noqa: E402

TEST_DB = "sokol_pytest"
ADMIN_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://sokol:sokol@localhost:5432/sokol",
)
TEST_URL = ADMIN_URL.rsplit("/", 1)[0] + f"/{TEST_DB}"
# The application inside ASGITransport must talk to the same isolated DB as fixtures.
os.environ["DATABASE_URL"] = TEST_URL

ROLES = ["superadmin", "director", "admin", "coach"]
PASSWORD = "Passw0rd!123"

REGION_ID = "22222222-2222-2222-2222-222222222222"
CENTER_ID = "11111111-1111-1111-1111-111111111111"
COACH_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture(scope="session")
async def engine():
    admin_engine = create_async_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        await conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)"))
        await conn.execute(text(f"CREATE DATABASE {TEST_DB}"))
    await admin_engine.dispose()

    test_engine = create_async_engine(TEST_URL)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()

    admin_engine = create_async_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        await conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)"))
    await admin_engine.dispose()


@pytest.fixture(scope="session")
async def session_maker(engine) -> AsyncIterator[async_sessionmaker]:
    yield async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
async def seeded_users(session_maker):
    """One user per role; roles table seeded."""
    from app.core.security import hash_password
    from app.models.user import Role, User, UserRole

    async with session_maker() as session:
        roles = {code: Role(code=code, name=code, description=code, is_system=True)
                 for code in ROLES}
        for role in roles.values():
            session.add(role)
        await session.flush()

        for i, (code, role) in enumerate(roles.items()):
            user = User(
                email=f"{code}@example.com",
                phone=f"+7000000000{i}",
                password_hash=hash_password(PASSWORD),
                first_name=code,
                last_name="Test",
            )
            session.add(user)
            await session.flush()
            session.add(UserRole(user_id=user.id, role_id=role.id))
        await session.commit()


@pytest.fixture(scope="session", autouse=True)
async def seeded_org(session_maker, seeded_users):
    """Region + center + coach row so FK-bearing requests succeed."""
    async with session_maker() as session:
        await session.execute(
            text("INSERT INTO regions (id, name, code) VALUES (:id, 'Тестовый регион', 'TR') "
                 "ON CONFLICT (id) DO NOTHING"),
            {"id": REGION_ID},
        )
        await session.execute(
            text("INSERT INTO centers (id, region_id, name, address, center_type, is_active) "
                 "VALUES (:id, :rid, 'ЦСЕ Тест', 'addr', 'cse', true) "
                 "ON CONFLICT (id) DO NOTHING"),
            {"id": CENTER_ID, "rid": REGION_ID},
        )
        await session.execute(
            text(
                "INSERT INTO coaches (id, user_id, center_id, specialization, is_active, "
                "hire_date) "
                "SELECT :cid, u.id, :center_id, 'Дзюдо', true, CURRENT_DATE FROM users u "
                "WHERE u.email = 'coach@example.com' "
                "ON CONFLICT (id) DO NOTHING",
            ),
            {"cid": COACH_ID, "center_id": CENTER_ID},
        )
        await session.commit()


@pytest.fixture(scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import app as fastapi_app

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(scope="session")
async def auth(client) -> dict[str, dict[str, str]]:
    """Role -> Authorization headers."""
    result: dict[str, dict[str, str]] = {}
    for role in ROLES:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": f"{role}@example.com", "password": PASSWORD},
        )
        assert resp.status_code == 200, resp.text
        token = resp.json()["access_token"]
        result[role] = {"Authorization": f"Bearer {token}"}
    return result
