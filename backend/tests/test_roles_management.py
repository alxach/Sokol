import uuid

from tests.conftest import PASSWORD


async def test_role_crud_lifecycle(client, auth):
    sa = auth["superadmin"]
    code = f"methodist{uuid.uuid4().hex[:4]}"

    resp = await client.post(
        "/api/v1/users/roles", headers=sa,
        json={"code": code, "name": "Методист"},
    )
    assert resp.status_code == 201, resp.text
    role_id = resp.json()["id"]

    resp = await client.post(
        "/api/v1/users/roles", headers=sa,
        json={"code": code, "name": "Дубль"},
    )
    assert resp.status_code == 409, resp.text

    resp = await client.patch(
        f"/api/v1/users/roles/{code}", headers=sa, json={"name": "Старший методист"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Старший методист"
    assert resp.json()["id"] == role_id

    resp = await client.delete(f"/api/v1/users/roles/{code}", headers=sa)
    assert resp.status_code == 200, resp.text

    resp = await client.get("/api/v1/users/roles", headers=sa)
    assert resp.status_code == 200, resp.text
    assert all(r["code"] != code for r in resp.json()["data"])


async def test_system_role_cannot_be_deleted(client, auth):
    resp = await client.delete("/api/v1/users/roles/superadmin", headers=auth["superadmin"])
    assert resp.status_code == 409, resp.text


async def test_role_in_use_cannot_be_deleted(client, auth):
    resp = await client.delete("/api/v1/users/roles/coach", headers=auth["superadmin"])
    assert resp.status_code == 409, resp.text


async def test_reset_password_and_login(client, auth):
    sa = auth["superadmin"]
    email = f"reset-{uuid.uuid4().hex[:8]}@example.com"
    user_id = (await client.post(
        "/api/v1/users", headers=sa,
        json={
            "email": email,
            "phone": f"+7999{uuid.uuid4().hex[:7]}",
            "password": PASSWORD,
            "first_name": "Reset", "last_name": "User",
            "role_codes": ["coach"],
        },
    )).json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/reset-password", headers=sa)
    assert resp.status_code == 200, resp.text
    new_password = resp.json()["temporary_password"]
    assert len(new_password) > 0

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": new_password},
    )
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert resp.status_code == 401, resp.text
