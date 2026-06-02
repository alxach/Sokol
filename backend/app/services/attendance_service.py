import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func, select

from app.models.attendance import Attendance, AttendanceQRCode
from app.models.group import Group, GroupMember
from app.models.schedule import Schedule
from app.repositories import AttendanceRepository


class AttendanceService:
    def __init__(self, attendance_repo: AttendanceRepository) -> None:
        self.repo = attendance_repo

    async def mark(self, data):
        return await self.repo.create(**data.model_dump())

    async def batch_mark(self, data):
        results = []
        for record in data.records:
            r = await self.repo.create(
                group_id=data.group_id, schedule_id=data.schedule_id,
                date=data.date, **record.model_dump(),
            )
            results.append(r)
        return results

    async def list_by_date(self, date_str: str, group_id: str | None = None):
        filters = {"date": date_str}
        if group_id:
            filters["group_id"] = group_id
        items, total = await self.repo.list(**filters)
        return {"items": items, "total": total}

    async def update(self, record_id: str, data) -> Attendance | None:
        return await self.repo.update(record_id, **data.model_dump(exclude_none=True))

    async def get_stats(self, today: date | None = None) -> dict:
        today = today or date.today()
        weekday = today.weekday()
        week_start = today - timedelta(days=weekday)
        month_start = today.replace(day=1)
        yesterday = today - timedelta(days=1)
        prev_week_start = week_start - timedelta(days=7)

        async def rate_for(start: date, end: date) -> float:
            stmt = select(func.count()).select_from(
                select(Attendance.status).where(
                    Attendance.date.between(start, end),
                ).subquery(),
            )
            total = (await self.repo.session.execute(stmt)).scalar() or 0
            present_stmt = select(func.count()).select_from(
                select(Attendance.status).where(
                    Attendance.date.between(start, end),
                    Attendance.status == "present",
                ).subquery(),
            )
            present = (await self.repo.session.execute(present_stmt)).scalar() or 0
            return round((present / total * 100) if total else 0, 1)

        async def absences_for(start: date, end: date) -> int:
            stmt = select(func.count()).select_from(
                select(Attendance.status).where(
                    Attendance.date.between(start, end),
                    Attendance.status == "absent",
                ).subquery(),
            )
            return (await self.repo.session.execute(stmt)).scalar() or 0

        today_rate = await rate_for(today, today)
        yesterday_rate = await rate_for(yesterday, yesterday)
        today_diff = round(today_rate - yesterday_rate, 1)

        week_rate = await rate_for(week_start, today)
        prev_week_rate = await rate_for(prev_week_start, week_start - timedelta(days=1))
        week_diff = round(week_rate - prev_week_rate, 1)

        month_rate = await rate_for(month_start, today)

        absences_total = await absences_for(month_start, today)
        prev_month_start = month_start - timedelta(days=month_start.day)
        absences_prev = await absences_for(prev_month_start, month_start - timedelta(days=1))
        absences_diff = absences_total - absences_prev

        return {
            "today_rate": today_rate,
            "today_diff": today_diff,
            "week_rate": week_rate,
            "week_diff": week_diff,
            "month_rate": month_rate,
            "absences_total": absences_total,
            "absences_diff": absences_diff,
        }

    async def get_heatmap(self, days: int = 28) -> list[dict]:
        end = date.today()
        start = end - timedelta(days=days - 1)
        items, _ = await self.repo.list(
            date_from=start.isoformat(),
            date_to=end.isoformat(),
            per_page=100000,
        )
        daily: dict[date, dict] = {}
        for a in items:
            d = a.date if isinstance(a.date, date) else a.date
            if d not in daily:
                daily[d] = {"present": 0, "absent": 0, "excused": 0, "total": 0}
            daily[d]["total"] += 1
            if a.status == "present":
                daily[d]["present"] += 1
            elif a.status == "absent":
                daily[d]["absent"] += 1
            else:
                daily[d]["excused"] += 1

        result = []
        for i in range(days):
            d = start + timedelta(days=i)
            if d in daily:
                info = daily[d]
                rate = round((info["present"] / info["total"] * 100) if info["total"] else 0, 1)
            else:
                rate = 0.0
            result.append({"date": d.isoformat(), "rate": rate})
        return result

    async def get_today_trainings(self, coach_id: str | None = None) -> list[dict]:
        today_date = date.today()
        today_weekday = today_date.weekday()
        stmt = (
            select(Schedule, Group)
            .join(Group, Schedule.group_id == Group.id)
            .where(
                Schedule.day_of_week == today_weekday,
                Group.is_active.is_(True),
            )
        )
        if coach_id:
            stmt = stmt.where(Schedule.coach_id == coach_id)

        result = await self.repo.session.execute(stmt)
        rows = result.all()

        items = []
        for schedule, group in rows:
            enrolled_stmt = select(func.count()).select_from(
                select(GroupMember).where(
                    GroupMember.group_id == group.id,
                    GroupMember.is_active.is_(True),
                ).subquery(),
            )
            enrolled = (await self.repo.session.execute(enrolled_stmt)).scalar() or 0

            present_stmt = select(func.count()).select_from(
                select(Attendance).where(
                    Attendance.schedule_id == schedule.id,
                    Attendance.date == today_date,
                    Attendance.status == "present",
                ).subquery(),
            )
            present = (await self.repo.session.execute(present_stmt)).scalar() or 0

            items.append({
                "id": str(schedule.id),
                "group_name": group.name,
                "discipline": group.sport_type,
                "coach_id": str(schedule.coach_id),
                "start_time": schedule.start_time.isoformat() if schedule.start_time else None,
                "end_time": schedule.end_time.isoformat() if schedule.end_time else None,
                "enrolled": enrolled,
                "present": present,
                "status": present / enrolled if enrolled else 0,
            })
        return items

    async def generate_qr(self, data) -> dict:
        qr_code_str = str(uuid.uuid4()).replace("-", "")[:16]
        session = self.repo.session
        qr = AttendanceQRCode(
            id=str(uuid.uuid4()),
            schedule_id=data.schedule_id,
            qr_code=qr_code_str,
            valid_date=data.valid_date,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
            is_active=True,
        )
        session.add(qr)
        await session.flush()
        return {
            "qr_code": qr_code_str,
            "valid_date": data.valid_date.isoformat(),
            "valid_from": data.valid_from.isoformat(),
            "valid_until": data.valid_until.isoformat(),
        }

    async def scan_qr(self, qr_code: str, athlete_id: str) -> Attendance:
        session = self.repo.session
        stmt = select(AttendanceQRCode).where(
            AttendanceQRCode.qr_code == qr_code,
            AttendanceQRCode.is_active.is_(True),
            AttendanceQRCode.valid_date == date.today(),
            AttendanceQRCode.valid_from <= datetime.now().time(),
            AttendanceQRCode.valid_until >= datetime.now().time(),
        )
        qr = (await session.execute(stmt)).scalar_one_or_none()
        if not qr:
            raise ValueError("QR-код недействителен или истёк")

        att = Attendance(
            id=str(uuid.uuid4()),
            athlete_id=athlete_id,
            schedule_id=qr.schedule_id,
            date=date.today(),
            status="present",
            check_in_time=datetime.now().time(),
            check_in_method="qr",
        )
        session.add(att)
        await session.flush()
        return att
