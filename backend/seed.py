"""Seed test data for local development."""

import asyncio
import uuid
from datetime import date, datetime, time, timedelta

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.athlete import Athlete
from app.models.attendance import Attendance
from app.models.coach import Coach
from app.models.event import Competition, Event, Participant, Result
from app.models.group import Group, GroupMember
from app.models.organization import Center, Region
from app.models.schedule import Schedule
from app.models.user import UserRole, Role, User


async def seed():
    engine = create_async_engine(settings.db_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        existing = await session.execute(select(User).limit(1))
        if existing.scalar():
            print("Data already seeded, skipping.")
            return

        role = Role(code="superadmin", name="Superadmin", is_system=True)
        session.add(role)
        admin_role = Role(code="admin", name="Admin", is_system=True)
        session.add(admin_role)
        coach_role = Role(code="coach", name="Coach", is_system=True)
        session.add(coach_role)
        await session.flush()

        pwd = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
        user = User(
            email="admin@sokol.ru", phone="+79000000001",
            password_hash=pwd, first_name="Иван",
            last_name="Воронов", is_active=True,
        )
        session.add(user)
        await session.flush()
        session.add(UserRole(user_id=user.id, role_id=role.id))

        coach_user = User(
            email="coach@sokol.ru", phone="+79000000002",
            password_hash=pwd, first_name="Марина",
            last_name="Соколова", is_active=True,
        )
        session.add(coach_user)
        await session.flush()
        session.add(UserRole(user_id=coach_user.id, role_id=coach_role.id))

        regions = [
            Region(name="Москва", code="MSK"),
            Region(name="Санкт-Петербург", code="SPB"),
            Region(name="Казань", code="KZN"),
            Region(name="Екатеринбург", code="EKB"),
            Region(name="Новосибирск", code="NSK"),
            Region(name="Омск", code="OMS"),
        ]
        session.add_all(regions)
        await session.flush()

        centers = [
            Center(name="ЦСЕ Москва", region_id=regions[0].id, address="ул. Спортивная 1"),
            Center(name="ЦСЕ СПб", region_id=regions[1].id, address="пр. Победы 10"),
            Center(name="ЦСЕ Казань", region_id=regions[2].id, address="ул. Батурина 5"),
        ]
        session.add_all(centers)
        await session.flush()

        coaches = [
            Coach(user_id=coach_user.id, center_id=centers[0].id, specialization="Самбо", hire_date=date.today()),
            Coach(user_id=user.id, center_id=centers[0].id, specialization="Дзюдо", hire_date=date.today()),
        ]
        session.add_all(coaches)
        await session.flush()

        groups = [
            Group(name="Группа А-1", center_id=centers[0].id, coach_id=coaches[0].id, sport_type="Самбо", max_capacity=20),
            Group(name="Группа Б-3", center_id=centers[0].id, coach_id=coaches[1].id, sport_type="Дзюдо", max_capacity=18),
        ]
        session.add_all(groups)
        await session.flush()

        schedules = [
            Schedule(
                group_id=groups[0].id, center_id=centers[0].id,
                coach_id=coaches[0].id, day_of_week=date.today().weekday(),
                start_time=time(16, 0), end_time=time(17, 30),
            ),
            Schedule(
                group_id=groups[1].id, center_id=centers[0].id,
                coach_id=coaches[1].id, day_of_week=date.today().weekday(),
                start_time=time(17, 30), end_time=time(19, 0),
            ),
        ]
        session.add_all(schedules)
        await session.flush()

        athletes = []
        names = [
            ("Дмитрий", "Волков"), ("Елена", "Кузнецова"), ("Сергей", "Смирнов"),
            ("Максим", "Белов"), ("Игорь", "Иванов"), ("Анна", "Петрова"),
            ("Павел", "Сидоров"), ("Ольга", "Фёдорова"), ("Николай", "Морозов"),
            ("Татьяна", "Новикова"), ("Алексей", "Козлов"), ("Мария", "Зайцева"),
        ]
        for first, last in names:
            a = Athlete(
                first_name=first, last_name=last,
                birth_date=date(2012, 3, 15), gender="male",
                center_id=centers[0].id, coach_id=coaches[0].id,
                sport_type="Самбо", status="active",
            )
            athletes.append(a)
        session.add_all(athletes)
        await session.flush()

        for a in athletes[:8]:
            session.add(GroupMember(group_id=groups[0].id, athlete_id=a.id, join_date=date.today()))
        for a in athletes[4:12]:
            session.add(GroupMember(group_id=groups[1].id, athlete_id=a.id, join_date=date.today()))

        event = Event(
            name="Чемпионат России по самбо",
            event_type="tournament", center_id=centers[0].id,
            start_date=date.today() + timedelta(days=14),
            end_date=date.today() + timedelta(days=17),
            location="Москва", status="active",
        )
        session.add(event)
        await session.flush()

        comp = Competition(
            event_id=event.id, name="Самбо мужчины 75кг",
            discipline="Самбо", competition_type="individual", status="active",
        )
        session.add(comp)
        await session.flush()

        for a in athletes[:5]:
            p = Participant(competition_id=comp.id, athlete_id=a.id, status="confirmed")
            session.add(p)
        await session.flush()

        now = datetime.utcnow()
        for day_offset in range(10):
            d = date.today() - timedelta(days=day_offset)
            sid = schedules[0].id if day_offset % 2 == 0 else schedules[1].id
            for a in athletes[:8]:
                att_status = "present" if hash(f"{a.id}_{d}") % 10 > 1 else "absent"
                att = Attendance(
                    athlete_id=a.id, group_id=groups[0].id,
                    schedule_id=sid, date=d,
                    status=att_status, check_in_time=now.time(),
                    check_in_method="manual",
                )
                session.add(att)
        await session.commit()

        print("Seed data inserted successfully!")
        print(f"  Users: 2 (admin@sokol.ru / admin123, coach@sokol.ru / admin123)")
        print(f"  Regions: 3, Centers: 3")
        print(f"  Coaches: 2, Groups: 2, Schedules: 2")
        print(f"  Athletes: 12")
        print(f"  Events: 1, Participants: 5")
        print(f"  Attendance records: 80 (8 athletes x 10 days)")


if __name__ == "__main__":
    asyncio.run(seed())
