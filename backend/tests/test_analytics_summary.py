import uuid

from tests.conftest import CENTER_ID, COACH_ID


async def _summary(client, headers):
    resp = await client.get("/api/v1/analytics/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_analytics_summary_requires_admin(client, auth):
    anonymous = await client.get("/api/v1/analytics/summary")
    assert anonymous.status_code in (401, 403)

    coach = await client.get(
        "/api/v1/analytics/summary", headers=auth["coach"]
    )
    assert coach.status_code == 403

    admin = await client.get(
        "/api/v1/analytics/summary", headers=auth["admin"]
    )
    assert admin.status_code == 200


async def test_analytics_summary_aggregates(client, auth):
    headers = auth["superadmin"]

    resp = await client.post(
        "/api/v1/athletes",
        headers=headers,
        json={
            "first_name": f"Sport{uuid.uuid4().hex[:5]}",
            "last_name": "Analytic",
            "birth_date": "2010-05-01",
            "gender": "m",
            "sport_type": "Дзюдо",
            "center_id": CENTER_ID,
            "coach_id": COACH_ID,
        },
    )
    assert resp.status_code == 200, resp.text
    athlete_id = str(resp.json()["id"])

    resp = await client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "name": f"Событие {uuid.uuid4().hex[:6]}",
            "event_type": "competition",
            "start_date": "2026-07-15",
            "end_date": "2026-07-16",
            "location": "Зал",
        },
    )
    assert resp.status_code == 200, resp.text
    event_id = str(resp.json()["id"])

    resp = await client.post(
        f"/api/v1/events/{event_id}/competitions",
        headers=headers,
        json={
            "name": f"Схватки {uuid.uuid4().hex[:6]}",
            "discipline": "Дзюдо",
            "competition_type": "competition",
        },
    )
    assert resp.status_code == 200, resp.text
    competition_id = str(resp.json()["id"])

    resp = await client.put(
        f"/api/v1/events/competitions/{competition_id}/results/{athlete_id}",
        headers=headers,
        json={"result": "золото"},
    )
    assert resp.status_code == 200, resp.text

    summary = await _summary(client, headers)

    assert summary["kpis"]["athletes"] >= 1
    assert summary["kpis"]["coaches"] >= 1
    assert summary["kpis"]["competitions"] >= 1
    assert summary["kpis"]["medals"]["gold"] >= 1

    disciplines = {d["name"]: d["value"] for d in summary["athletes_by_discipline"]}
    assert disciplines.get("Дзюдо", 0) >= 1

    statuses = {s["name"]: s["value"] for s in summary["athletes_by_status"]}
    assert statuses.get("Активные", 0) >= 1

    gold_dynamics = [d for d in summary["medal_dynamics"] if d["gold"] > 0]
    assert gold_dynamics, "медаль не попала в динамику за 12 месяцев"
    assert gold_dynamics[0]["gold"] >= 1

    top_names = [t["name"] for t in summary["top_athletes"]]
    assert len(top_names) >= 1
    top = summary["top_athletes"][0]
    assert top["medals"]["gold"] >= 1
    assert top["points"] >= 3
    assert any(c["athletes"] >= 1 for c in summary["coach_workload"])
