import pytest
from sqlalchemy import text

CENTER_ID = "11111111-1111-1111-1111-111111111111"
SECOND_CENTER_ID = "77777777-7777-7777-7777-777777777777"


def criteria_payload(**overrides):
    payload = {
        "athletes_full": 30,
        "athletes_basic": 15,
        "hours_full": 9.0,
        "hours_basic": 4.5,
        "social_events_full": 2,
        "social_events_basic": 1,
        "sports_events_full": 2,
        "sports_events_basic": 1,
        "development_events_full": 2,
        "development_events_basic": 1,
    }
    payload.update(overrides)
    return payload


@pytest.fixture(scope="module")
def _additional_center(session_maker):
    async def _ensure():
        from tests.conftest import REGION_ID

        async with session_maker() as session:
            await session.execute(
                text("INSERT INTO centers (id, region_id, name, address, center_type, is_active) "
                     "VALUES (:id, :rid, 'ЦСЕ Второй', 'addr2', 'cse', true) "
                     "ON CONFLICT (id) DO NOTHING"),
                {"id": SECOND_CENTER_ID, "rid": REGION_ID},
            )
            await session.commit()

    return _ensure


@pytest.fixture(scope="module")
def set_admin_center(session_maker):
    async def _set(center_id: str | None):
        async with session_maker() as session:
            await session.execute(
                text("UPDATE users SET center_id = :c WHERE email = 'admin@example.com'"),
                {"c": center_id},
            )
            await session.commit()

    return _set


async def test_admin_upsert_own_center(client, auth, set_admin_center, _additional_center):
    await _additional_center()
    await set_admin_center(CENTER_ID)
    try:
        resp = await client.put(
            f"/api/v1/incentive/criteria/{CENTER_ID}",
            json=criteria_payload(),
            headers=auth["admin"],
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["center_id"] == CENTER_ID
        assert body["athletes_full"] == 30
        assert body["social_events_full"] == 2
        assert body["center_name"]

        updated = await client.put(
            f"/api/v1/incentive/criteria/{CENTER_ID}",
            json=criteria_payload(athletes_full=35),
            headers=auth["admin"],
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["athletes_full"] == 35
    finally:
        await set_admin_center(None)


async def test_admin_cannot_edit_other_center(client, auth, set_admin_center, _additional_center):
    await _additional_center()
    await set_admin_center(CENTER_ID)
    try:
        resp = await client.put(
            f"/api/v1/incentive/criteria/{SECOND_CENTER_ID}",
            json=criteria_payload(),
            headers=auth["admin"],
        )
        assert resp.status_code == 403, resp.text
    finally:
        await set_admin_center(None)


async def test_director_and_superadmin_any_center(client, auth, _additional_center):
    await _additional_center()
    for role in ("director", "superadmin"):
        resp = await client.put(
            f"/api/v1/incentive/criteria/{SECOND_CENTER_ID}",
            json=criteria_payload(sports_events_full=3),
            headers=auth[role],
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["sports_events_full"] == 3


async def test_coach_read_only(client, auth, set_admin_center, _additional_center):
    await _additional_center()
    await set_admin_center(CENTER_ID)
    try:
        data = criteria_payload(athletes_full=40)
        resp = await client.put(
            f"/api/v1/incentive/criteria/{CENTER_ID}", json=data, headers=auth["admin"],
        )
        assert resp.status_code == 200, resp.text

        listing = await client.get(
            "/api/v1/incentive/criteria",
            headers=auth["coach"],
        )
        assert listing.status_code == 200, listing.text
        assert listing.json()[0]["center_id"] == CENTER_ID
        assert listing.json()[0]["athletes_full"] == 40

        denied = await client.put(
            f"/api/v1/incentive/criteria/{CENTER_ID}",
            json=data,
            headers=auth["coach"],
        )
        assert denied.status_code == 403, denied.text
    finally:
        await set_admin_center(None)


async def test_upsert_validates_basic_not_above_full(client, auth, set_admin_center):
    await set_admin_center(CENTER_ID)
    try:
        resp = await client.put(
            f"/api/v1/incentive/criteria/{CENTER_ID}",
            json=criteria_payload(athletes_basic=31),
            headers=auth["admin"],
        )
        assert resp.status_code == 422, resp.text
        assert "полный порог" in resp.json()["detail"].lower()
    finally:
        await set_admin_center(None)


async def test_director_lists_all_criteria_by_center_filter(client, auth, set_admin_center):
    await set_admin_center(CENTER_ID)
    try:
        created = await client.put(
            f"/api/v1/incentive/criteria/{CENTER_ID}",
            json=criteria_payload(athletes_full=42),
            headers=auth["director"],
        )
        assert created.status_code == 200, created.text

        listing = await client.get(
            "/api/v1/incentive/criteria",
            headers=auth["director"],
        )
        assert listing.status_code == 200, listing.text
        ids = {row["center_id"] for row in listing.json()}
        assert CENTER_ID in ids
    finally:
        await set_admin_center(None)
