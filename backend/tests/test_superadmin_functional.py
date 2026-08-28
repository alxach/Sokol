import uuid
from datetime import date

import pytest

from app.models.document import DocumentTemplate
from app.models.incentive_program import IncentiveProgram

pytestmark = pytest.mark.asyncio


@pytest.fixture(scope="module")
async def seeded_doc_template(session_maker):
    async with session_maker() as session:
        tpl = DocumentTemplate(
            name="Заявление",
            code=f"stmt-{uuid.uuid4().hex[:8]}",
            doc_type="statement",
            template_fields_json={"fields": []},
            is_active=True,
        )
        session.add(tpl)
        await session.commit()
    return str(tpl.id)


@pytest.fixture(scope="module")
async def seeded_program(session_maker):
    async with session_maker() as session:
        program = IncentiveProgram(
            name="Программа стимулирования",
            regulation_number=f"П-{uuid.uuid4().hex[:6].upper()}",
            regulation_date=date(2026, 7, 9),
            revision=8,
            max_payout=50000,
            min_payout=25000,
            ndfl_rate=13.0,
            insurance_rate=30.2,
            is_discretionary=True,
            status="active",
        )
        session.add(program)
        await session.commit()
    return str(program.id)


async def _post(client, path, headers, body, expected=200):
    resp = await client.post(path, json=body, headers=headers)
    assert resp.status_code == expected, f"{path}: {resp.status_code} {resp.text}"
    return resp


async def test_superadmin_full_functional_flow(
    client, auth, seeded_doc_template, seeded_program,
):
    sa = auth["superadmin"]
    today = date.today().isoformat()
    dow = date.today().weekday()
    if dow < 1:
        dow = 1

    async def get(path, **kw):
        resp = await client.get(path, headers={**(kw.pop("headers", sa)), **kw})
        assert resp.status_code == 200, f"{path}: {resp.status_code} {resp.text}"
        return resp

    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "superadmin@example.com", "password": "Passw0rd!123"},
    )
    assert resp.status_code == 200, resp.text
    refresh_token = resp.json()["refresh_token"]

    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200, resp.text
    new_access = resp.json()["access_token"]

    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {new_access}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == "superadmin@example.com"

    reg_email = f"reg-{uuid.uuid4().hex[:8]}@example.com"
    resp = await _post(
        client, "/api/v1/auth/register", {},
        {
            "email": reg_email,
            "phone": "+79991234599",
            "password": "Passw0rd!123",
            "first_name": "Новичок",
            "last_name": "Тестов",
        },
    )
    assert resp.json()["user"]["roles"] == ["coach"]

    region_name = f"Region {uuid.uuid4().hex[:6]}"
    resp = await _post(
        client, "/api/v1/organizations/regions", sa,
        {"name": region_name, "code": f"REG-{uuid.uuid4().hex[:6].upper()}"},
    )
    region_id = resp.json()["id"]

    center_name = f"Center {uuid.uuid4().hex[:6]}"
    resp = await _post(
        client, "/api/v1/organizations/centers", sa,
        {
            "name": center_name,
            "region_id": region_id,
            "address": "ул. Тестовая, 1",
            "center_type": "cse",
        },
    )
    second_center_id = resp.json()["id"]

    await get("/api/v1/organizations/regions")
    resp = await get("/api/v1/organizations/centers")
    assert any(c["id"] == second_center_id for c in resp.json())

    await get("/api/v1/users/roles")
    resp = await get("/api/v1/users")
    assert resp.json()["meta"]["total"] >= 4

    user_email = f"coach-{uuid.uuid4().hex[:8]}@example.com"
    resp = await _post(
        client, "/api/v1/users", sa,
        {
            "email": user_email,
            "phone": "+79991112233",
            "password": "Passw0rd!123",
            "first_name": "Тренер",
            "last_name": "Новый",
            "role_codes": ["coach"],
            "center_id": "11111111-1111-1111-1111-111111111111",
        },
        expected=201,
    )
    new_user_id = resp.json()["id"]

    resp = await client.put(
        f"/api/v1/users/{new_user_id}",
        json={"first_name": "Тренер-2", "last_name": "Обновлённый"},
        headers=sa,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["first_name"] == "Тренер-2"

    resp = await _post(
        client, f"/api/v1/users/{new_user_id}/roles", sa,
        {"role_codes": ["coach", "director"]},
    )
    assert sorted(r["code"] for r in resp.json()["roles"]) == ["coach", "director"]

    resp = await client.delete(f"/api/v1/users/{new_user_id}", headers=sa)
    assert resp.status_code == 200, resp.text
    resp = await client.get(f"/api/v1/users/{new_user_id}", headers=sa)
    assert resp.status_code == 404, resp.text

    coach_name = f"coach-name-{uuid.uuid4().hex[:6]}"
    resp = await _post(
        client, "/api/v1/coaches", sa,
        {
            "user_id": new_user_id,
            "center_id": "11111111-1111-1111-1111-111111111111",
            "specialization": coach_name,
            "hire_date": "2025-01-10",
        },
    )
    coach_id = resp.json()["id"]

    await get("/api/v1/coaches")
    await get(f"/api/v1/coaches/{coach_id}")
    resp = await client.patch(
        f"/api/v1/coaches/{coach_id}",
        json={"specialization": "Дзюдо + Самбо"},
        headers=sa,
    )
    assert resp.status_code == 200, resp.text

    athletes = []
    for i in range(3):
        resp = await _post(
            client, "/api/v1/athletes", sa,
            {
                "first_name": f"Спортсмен-{i}",
                "last_name": f"Фамилия-{uuid.uuid4().hex[:6]}",
                "birth_date": "2012-05-04",
                "gender": "male",
                "center_id": "11111111-1111-1111-1111-111111111111",
                "coach_id": coach_id,
                "sport_type": "Дзюдо",
            },
        )
        athletes.append(resp.json()["id"])

    await get("/api/v1/athletes")
    await get(f"/api/v1/athletes/{athletes[0]}")
    resp = await client.patch(
        f"/api/v1/athletes/{athletes[0]}",
        json={"rank": "КМС", "status": "active", "notes": "лидер группы"},
        headers=sa,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["rank"] == "КМС"

    await _post(
        client, f"/api/v1/athletes/{athletes[0]}/documents", sa,
        {
            "doc_type": "Паспорт",
            "doc_number": "1234 567890",
            "issue_date": "2020-01-01",
            "expire_date": "2030-01-01",
        },
    )
    await _post(
        client, f"/api/v1/athletes/{athletes[0]}/medical", sa,
        {
            "medical_type": "Допуск к соревнованиям",
            "examination_date": "2026-01-10",
            "valid_until": "2027-01-10",
            "doctor_name": "Иванов А.А.",
        },
    )
    await _post(
        client, f"/api/v1/athletes/{athletes[0]}/ranks", sa,
        {
            "rank_after": "КМС",
            "rank_before": "1 разряд",
            "assign_date": "2026-01-15",
            "order_number": "88-п",
        },
    )
    await _post(
        client, f"/api/v1/athletes/{athletes[0]}/achievements", sa,
        {
            "achievement_type": "comp",
            "place": "1",
            "medal": "gold",
            "date": "2026-02-20",
            "description": "Первенство региона",
        },
    )

    group_name = f"Group-{uuid.uuid4().hex[:6]}"
    resp = await _post(
        client, "/api/v1/groups", sa,
        {
            "name": group_name,
            "center_id": "11111111-1111-1111-1111-111111111111",
            "coach_id": coach_id,
            "sport_type": "Дзюдо",
            "age_group": "12-15",
            "max_capacity": 20,
        },
    )
    group_id = resp.json()["id"]

    await _post(
        client, f"/api/v1/groups/{group_id}/members", sa,
        {"athlete_id": athletes[0], "join_date": "2026-08-01"},
    )
    await _post(
        client, f"/api/v1/groups/{group_id}/members", sa,
        {"athlete_id": athletes[1], "join_date": "2026-08-15"},
    )
    group = await get(f"/api/v1/groups/{group_id}")
    assert group.json()["name"] == group_name
    await get("/api/v1/groups")

    schedule_a = await _post(
        client, "/api/v1/schedules", sa,
        {
            "group_id": group_id,
            "center_id": "11111111-1111-1111-1111-111111111111",
            "coach_id": coach_id,
            "day_of_week": dow,
            "start_time": "10:00:00",
            "end_time": "11:30:00",
            "location": "Зал А",
            "room": "101",
        },
    )
    schedule_a_id = schedule_a.json()["id"]

    schedule_b = await _post(
        client, "/api/v1/schedules", sa,
        {
            "group_id": group_id,
            "day_of_week": dow,
            "start_time": "11:30:00",
            "end_time": "13:00:00",
        },
    )
    resp = await get(f"/api/v1/schedules/by-group/{group_id}")
    assert any(s["id"] == schedule_a_id for s in resp.json())

    resp = await client.delete(
        f"/api/v1/schedules/{schedule_b.json()['id']}", headers=sa,
    )
    assert resp.status_code == 200, resp.text

    attendance_1 = await _post(
        client, "/api/v1/attendance/mark", sa,
        {
            "athlete_id": athletes[0],
            "schedule_id": schedule_a_id,
            "date": today,
            "status": "present",
        },
    )
    attendance_1_id = attendance_1.json()["id"]

    await _post(
        client, "/api/v1/attendance/batch", sa,
        {
            "group_id": group_id,
            "date": today,
            "records": [
                {
                    "athlete_id": athletes[1],
                    "schedule_id": schedule_a_id,
                    "date": today,
                    "status": "absent",
                },
            ],
        },
    )

    resp = await client.patch(
        f"/api/v1/attendance/{attendance_1_id}",
        json={"status": "excused"},
        headers=sa,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "excused"

    resp = await client.get(f"/api/v1/attendance?date={today}", headers=sa)
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 2

    await get("/api/v1/attendance/stats")
    await get("/api/v1/attendance/stats/heatmap")
    await get("/api/v1/attendance/today")

    qr = await _post(
        client, "/api/v1/attendance/qr/generate", sa,
        {
            "schedule_id": schedule_a_id,
            "valid_date": today,
            "valid_from": "00:00:00",
            "valid_until": "23:59:59",
        },
    )
    qr_code = qr.json()["qr_code"]

    await _post(
        client, "/api/v1/attendance/qr/scan", sa,
        {"qr_code": qr_code, "athlete_id": athletes[2]},
    )

    event = await _post(
        client, "/api/v1/events", sa,
        {
            "name": f"Event-{uuid.uuid4().hex[:6]}",
            "event_type": "competition",
            "center_id": "11111111-1111-1111-1111-111111111111",
            "start_date": "2026-09-01",
            "end_date": "2026-09-02",
            "location": "ДС «Сокол»",
        },
    )
    event_id = event.json()["id"]

    competition = await _post(
        client, f"/api/v1/events/{event_id}/competitions", sa,
        {
            "name": "Кубок по дзюдо",
            "discipline": "дзюдо",
            "competition_type": "sporting",
            "max_participants": 64,
        },
    )
    competition_id = competition.json()["id"]

    await _post(
        client, f"/api/v1/events/competitions/{competition_id}/participants", sa,
        {"athlete_id": athletes[0]},
    )
    await _post(
        client, f"/api/v1/events/competitions/{competition_id}/results", sa,
        {"athlete_id": athletes[0], "position": 1, "medal": "gold"},
    )

    await get("/api/v1/events")
    await get(f"/api/v1/events/{event_id}")
    await get("/api/v1/events/stats")

    report_tpl = await _post(
        client, "/api/v1/reports/templates", sa,
        {
            "name": "Отчёт тренера",
            "code": f"tp-{uuid.uuid4().hex[:8]}",
            "report_type": "monthly",
            "structure_json": {"blocks": []},
        },
    )
    report_tpl_id = report_tpl.json()["id"]

    report = await _post(
        client, "/api/v1/reports", sa,
        {
            "template_id": report_tpl_id,
            "center_id": "11111111-1111-1111-1111-111111111111",
            "coach_id": coach_id,
            "period_type": "monthly",
            "period_start": "2026-08-01",
            "period_end": "2026-08-31",
            "data_json": {"athletes_count": 3, "hours": 48},
        },
    )
    report_id = report.json()["id"]
    assert report.json()["status"] == "draft"

    resp = await client.post(f"/api/v1/reports/{report_id}/submit", json={}, headers=sa)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "submitted"

    resp = await client.post(
        f"/api/v1/reports/{report_id}/approve", json={"comment": "утверждено"}, headers=sa,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"

    resp = await client.post(
        f"/api/v1/reports/{report_id}/reject", json={"comment": "поздно"}, headers=sa,
    )
    assert resp.status_code == 422, resp.text

    await get("/api/v1/incentive/programs")
    program_info = await get(f"/api/v1/incentive/programs/{seeded_program}")
    assert program_info.json()["status"] == "active"

    plan = await _post(
        client, "/api/v1/incentive/plans", sa,
        {
            "coach_id": coach_id,
            "center_id": "11111111-1111-1111-1111-111111111111",
            "program_id": seeded_program,
            "year": 2026,
        },
    )
    plan_id = plan.json()["id"]

    plan_item = await _post(
        client, f"/api/v1/incentive/plans/{plan_id}/items", sa,
        {
            "category": "СВ",
            "quarter": 3,
            "month": 8,
            "date": "2026-08-10",
            "name": "Учебно-тренировочный сбор",
            "location": "УТЦ",
            "participants_count": "15",
        },
    )
    assert plan_item.json()["status"] in ("draft", "submitted")

    await get(f"/api/v1/incentive/plans/{plan_id}/items")
    await get("/api/v1/incentive/plans")

    protocol = await _post(
        client, "/api/v1/incentive/protocols", sa,
        {
            "number": f"ПР-{uuid.uuid4().hex[:6].upper()}",
            "date": today,
            "beneficiary_name": "Иванов И.И.",
            "period": "2026-08",
            "center_id": "11111111-1111-1111-1111-111111111111",
            "agenda": "Утверждение выплат",
            "voting_for": 5,
            "voting_against": 0,
            "voting_abstained": 0,
        },
    )
    protocol_id = protocol.json()["id"]

    payout = await _post(
        client, f"/api/v1/incentive/protocols/{protocol_id}/payouts", sa,
        {
            "coach_id": coach_id,
            "sport_type": "Дзюдо",
            "period_start": "2026-08-01",
            "period_end": "2026-08-31",
            "gross_amount": "74827.24",
            "ndfl_amount": "0",
            "insurance_amount": "0",
            "net_amount": "0",
        },
    )
    assert abs(float(payout.json()["net_amount"]) - 50000.0) <= 0.5
    assert abs(float(payout.json()["ndfl_amount"]) - 7471.0) <= 0.5
    assert abs(float(payout.json()["insurance_amount"]) - 17356.24) <= 0.5

    await get(f"/api/v1/incentive/protocols/{protocol_id}/payouts")
    await get("/api/v1/incentive/protocols")

    doc = await _post(
        client, "/api/v1/documents", sa,
        {
            "template_id": seeded_doc_template,
            "file_url": "https://example.com/doc.pdf",
            "content_json": {"title": "Заявление", "body": "Прошу..."},
        },
    )
    doc_id = doc.json()["id"]

    await get("/api/v1/documents/templates")
    docs_list = await get("/api/v1/documents")
    assert any(d["id"] == doc_id for d in docs_list.json()[0])

    await _post(
        client, f"/api/v1/documents/{doc_id}/approve", sa,
        {"decision": "approved", "comment": "согласовано"},
    )

    for export_type in ["athletes", "coaches", "attendance", "events"]:
        resp = await client.get(f"/api/v1/exports/excel/{export_type}", headers=sa)
        assert resp.status_code == 200, f"{export_type}: {resp.status_code}"
        assert resp.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        assert len(resp.content) > 0

    resp = await client.get("/api/v1/exports/excel/unknown", headers=sa)
    assert resp.status_code == 400, resp.text

    await get("/api/v1/audit-logs")
    dashboard = await get("/api/v1/analytics/dashboard")
    assert "efficiency_score" in dashboard.json()
