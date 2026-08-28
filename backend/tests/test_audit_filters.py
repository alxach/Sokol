from datetime import date


async def test_audit_filters(client, auth):
    sa = auth["superadmin"]
    params = "".join([
        "?action=login",
        f"&date_from={date.today().isoformat()}",
        f"&date_to={date.today().isoformat()}",
        "&resource=users",
        "&page=1&per_page=50",
    ])
    resp = await client.get(f"/api/v1/audit-logs{params}", headers=sa)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "total" in body["meta"]
    assert isinstance(body["data"], list)
    for entry in body["data"]:
        assert entry["action"] == "login"


async def test_audit_bad_user_id(client, auth):
    resp = await client.get(
        "/api/v1/audit-logs?user_id=not-a-uuid", headers=auth["superadmin"],
    )
    assert resp.status_code == 422, resp.text
