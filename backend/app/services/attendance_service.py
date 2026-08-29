import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func, or_, select

from app.models.athlete import Athlete
from app.models.attendance import Attendance, AttendanceQRCode
from app.models.coach import Coach
from app.models.group import Group, GroupMember
from app.models.schedule import Schedule, SchedulePeriod
from app.models.user import User
from app.repositories import AttendanceRepository, SchedulePeriodRepository, ScheduleRepository

VALID_STATUSES = {"present", "absent", "excused"}


class AttendanceService:
    def __init__(
        self,
        attendance_repo: AttendanceRepository,
        schedule_repo: ScheduleRepository | None = None,
        period_repo: SchedulePeriodRepository | None = None,
    ) -> None:
        self.repo = attendance_repo
        self.schedule_repo = schedule_repo or ScheduleRepository(
            attendance_repo.session
        )
        self.period_repo = period_repo or SchedulePeriodRepository(
            attendance_repo.session
        )

    # ── helpers ──────────────────────────────────────────────

    async def _existing_record(
        self, athlete_id: str, schedule_id: str | None, date_value: date
    ) -> Attendance | None:
        stmt = select(Attendance).where(
            Attendance.athlete_id == athlete_id,
            Attendance.schedule_id == schedule_id,
            Attendance.date == date_value,
        )
        result = await self.repo.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _upsert(
        self,
        data,
        checked_by: str | None = None,
    ) -> Attendance:
        existing = await self._existing_record(
            data.athlete_id, data.schedule_id, data.date
        )
        if existing:
            existing.status = data.status
            existing.absence_reason = data.absence_reason
            if checked_by:
                existing.checked_by = checked_by
            await self.repo.session.flush()
            return existing
        group_id = None
        if data.schedule_id:
            schedule = await self.schedule_repo.get(data.schedule_id)
            group_id = str(schedule.group_id) if schedule and schedule.group_id else None
        return await self.repo.create(
            athlete_id=data.athlete_id,
            schedule_id=data.schedule_id,
            group_id=group_id,
            date=data.date,
            status=data.status,
            absence_reason=data.absence_reason,
            checked_by=checked_by,
        )

    def _to_snapshot(self, att: Attendance) -> dict:
        return {
            "id": str(att.id),
            "athlete_id": str(att.athlete_id),
            "schedule_id": str(att.schedule_id) if att.schedule_id else None,
            "group_id": str(att.group_id) if att.group_id else None,
            "date": att.date.isoformat(),
            "status": att.status,
            "absence_reason": att.absence_reason,
            "check_in_time": (
                att.check_in_time.strftime("%H:%M:%S") if att.check_in_time else None
            ),
            "check_in_method": att.check_in_method,
            "checked_by": str(att.checked_by) if att.checked_by else None,
        }

    # ── public API (mark/batch/update/list/delete) ──────────

    async def mark(self, data, checked_by: str | None = None) -> dict:
        if data.status not in VALID_STATUSES:
            raise ValueError("Недопустимый статус посещаемости")
        if data.date is None:
            raise ValueError("Дата посещаемости обязательна")
        att = await self._upsert(data, checked_by=checked_by)
        return self._to_snapshot(att)

    async def batch_mark(self, data, checked_by: str | None = None) -> list[dict]:
        results = []
        for record in data.records:
            if record.status not in VALID_STATUSES:
                raise ValueError("Недопустимый статус посещаемости")
            schedule_id = record.schedule_id or data.schedule_id
            if schedule_id is None:
                raise ValueError("Не указано занятие (schedule_id)")
            rec = record.model_copy(
                update={"schedule_id": schedule_id, "date": data.date}
            )
            att = await self._upsert(rec, checked_by=checked_by)
            results.append(self._to_snapshot(att))
        return results

    async def update(self, record_id: str, data) -> Attendance | None:
        if data.status is not None and data.status not in VALID_STATUSES:
            raise ValueError("Недопустимый статус посещаемости")
        return await self.repo.update(record_id, **data.model_dump(exclude_none=True))

    async def delete(self, record_id: str) -> bool:
        return await self.repo.delete(record_id)

    async def list_by_date(
        self,
        date_value: str | date | None = None,
        date_from: str | date | None = None,
        date_to: str | date | None = None,
        group_id: str | None = None,
        coach_user_id: str | None = None,
        center_id: str | None = None,
        page: int = 1,
        per_page: int = 200,
    ):
        stmt = select(Attendance)
        if date_value is not None:
            value = date.fromisoformat(date_value) if isinstance(date_value, str) else date_value
            stmt = stmt.where(Attendance.date == value)
        if date_from is not None:
            value = date.fromisoformat(date_from) if isinstance(date_from, str) else date_from
            stmt = stmt.where(Attendance.date >= value)
        if date_to is not None:
            value = date.fromisoformat(date_to) if isinstance(date_to, str) else date_to
            stmt = stmt.where(Attendance.date <= value)
        if group_id:
            stmt = stmt.where(Attendance.group_id == group_id)
        if coach_user_id or center_id:
            stmt = stmt.join(Schedule, Attendance.schedule_id == Schedule.id)
            stmt = stmt.join(
                SchedulePeriod, Schedule.period_id == SchedulePeriod.id, isouter=True
            )
            if coach_user_id:
                profile_stmt = select(Coach.id).where(Coach.user_id == coach_user_id)
                coach_ids = [
                    str(r) for r in (await self.repo.session.execute(profile_stmt)).scalars()
                ]
                if coach_ids:
                    stmt = stmt.where(
                        or_(
                            SchedulePeriod.coach_id.in_(coach_ids),
                            Schedule.coach_id.in_(coach_ids),
                        )
                    )
            if center_id:
                stmt = stmt.join(Group, Schedule.group_id == Group.id).where(
                    Group.center_id == center_id
                )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.repo.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)
        items = list((await self.repo.session.execute(stmt)).scalars().all())
        enriched = await self._enrich_records(items)
        return {"items": enriched, "total": total}

    async def _enrich_records(self, records: list[Attendance]) -> list[dict]:
        athlete_ids = {str(r.athlete_id) for r in records}
        schedule_ids = {str(r.schedule_id) for r in records if r.schedule_id}
        athletes_map: dict[str, Athlete] = {}
        if athlete_ids:
            result = await self.repo.session.execute(
                select(Athlete).where(Athlete.id.in_(athlete_ids))
            )
            athletes_map = {str(a.id): a for a in result.scalars()}

        period_map: dict[str, SchedulePeriod] = {}
        schedule_map: dict[str, Schedule] = {}
        if schedule_ids:
            srows = await self.repo.session.execute(
                select(Schedule).where(Schedule.id.in_(schedule_ids))
            )
            schedule_map = {str(s.id): s for s in srows.scalars()}
            period_ids = {str(s.period_id) for s in schedule_map.values() if s.period_id}
            if period_ids:
                prows = await self.repo.session.execute(
                    select(SchedulePeriod).where(SchedulePeriod.id.in_(period_ids))
                )
                period_map = {str(p.id): p for p in prows.scalars()}

        group_ids = {str(s.group_id) for s in schedule_map.values() if s.group_id}
        groups_map: dict[str, Group] = {}
        if group_ids:
            grow = await self.repo.session.execute(
                select(Group).where(Group.id.in_(group_ids))
            )
            groups_map = {str(g.id): g for g in grow.scalars()}

        coach_ids = {
            str(p.coach_id) if p.coach_id else None
            for p in period_map.values()
        } | {str(s.coach_id) if s.coach_id else None for s in schedule_map.values()}
        coach_ids.discard(None)
        coaches_map: dict[str, Coach] = {}
        if coach_ids:
            crow = await self.repo.session.execute(
                select(Coach).where(Coach.id.in_(coach_ids))
            )
            coaches_map = {str(c.id): c for c in crow.scalars()}
        user_ids = {str(c.user_id) for c in coaches_map.values() if c.user_id}
        users_map: dict[str, User] = {}
        if user_ids:
            urow = await self.repo.session.execute(
                select(User).where(User.id.in_(user_ids))
            )
            users_map = {str(u.id): u for u in urow.scalars()}

        def _coach_name(coach_id: str | None) -> str | None:
            if not coach_id:
                return None
            coach = coaches_map.get(coach_id)
            if not coach or not coach.user_id:
                return None
            user = users_map.get(str(coach.user_id))
            if not user:
                return None
            return " ".join(
                p for p in (user.last_name, user.first_name, (user.middle_name or "")) if p
            ) or user.first_name

        result = []
        for r in records:
            schedule = schedule_map.get(str(r.schedule_id))
            period = (
                period_map.get(str(schedule.period_id))
                if schedule and schedule.period_id
                else None
            )
            group = groups_map.get(str(schedule.group_id)) if schedule else None
            coach_id = period.coach_id if period else (schedule.coach_id if schedule else None)
            athlete = athletes_map.get(str(r.athlete_id))
            snapshot = self._to_snapshot(r)
            snapshot["athlete_name"] = (
                " ".join(
                    p
                    for p in (
                        athlete.last_name,
                        athlete.first_name,
                        (athlete.middle_name or ""),
                    )
                    if p
                )
                if athlete
                else None
            )
            snapshot["rank"] = athlete.rank if athlete else None
            snapshot["group_name"] = group.name if group else None
            snapshot["discipline"] = group.sport_type if group else None
            snapshot["coach_name"] = _coach_name(str(coach_id)) if coach_id else None
            result.append(snapshot)
        return result

    # ── coach journal ────────────────────────────────────────

    async def journal(
        self,
        date_value: str | date,
        coach_user_id: str | None = None,
    ) -> list[dict]:
        d = date.fromisoformat(date_value) if isinstance(date_value, str) else date_value
        day_of_week = d.weekday() + 1
        session = self.repo.session

        periods_stmt = select(SchedulePeriod).where(
            SchedulePeriod.status == "active",
            SchedulePeriod.period_start <= d,
            SchedulePeriod.period_end >= d,
        )
        periods = list((await session.execute(periods_stmt)).scalars().all())
        period_ids = [p.id for p in periods]

        schedule_stmt = select(Schedule).where(Schedule.day_of_week == day_of_week)
        if period_ids:
            schedule_stmt = schedule_stmt.where(
                or_(
                    Schedule.period_id.in_(period_ids),
                    Schedule.period_id.is_(None),
                )
            )
        else:
            schedule_stmt = schedule_stmt.where(Schedule.period_id.is_(None))

        if coach_user_id:
            profile_stmt = select(Coach.id).where(Coach.user_id == coach_user_id)
            coach_ids = [str(r) for r in (await session.execute(profile_stmt)).scalars()]
            if coach_ids:
                if period_ids:
                    schedule_stmt = schedule_stmt.left_join(
                        SchedulePeriod, Schedule.period_id == SchedulePeriod.id
                    ).where(
                        or_(
                            SchedulePeriod.coach_id.in_(coach_ids),
                            Schedule.period_id.is_(None) & Schedule.coach_id.in_(coach_ids),
                        )
                    )
                else:
                    schedule_stmt = schedule_stmt.where(Schedule.coach_id.in_(coach_ids))

        schedules = list((await session.execute(schedule_stmt)).scalars().all())
        if not schedules:
            return []

        schedule_ids = {s.id for s in schedules}
        period_map = {str(p.id): p for p in periods}
        group_ids = {str(s.group_id) for s in schedules if s.group_id}
        groups_map: dict[str, Group] = {}
        if group_ids:
            grow = await session.execute(select(Group).where(Group.id.in_(group_ids)))
            groups_map = {str(g.id): g for g in grow.scalars()}

        coach_ids = {
            str(period_map.get(str(s.period_id)).coach_id)
            if s.period_id and period_map.get(str(s.period_id))
            else (str(s.coach_id) if s.coach_id else None)
            for s in schedules
        }
        coach_ids.discard(None)
        coaches_map: dict[str, Coach] = {}
        users_map: dict[str, User] = {}
        if coach_ids:
            crow = await session.execute(select(Coach).where(Coach.id.in_(coach_ids)))
            coaches_map = {str(c.id): c for c in crow.scalars()}
            user_ids = {str(c.user_id) for c in coaches_map.values() if c.user_id}
            if user_ids:
                urow = await session.execute(select(User).where(User.id.in_(user_ids)))
                users_map = {str(u.id): u for u in urow.scalars()}

        enrolled_map: dict[str, list[Athlete]] = {}
        for gid in group_ids:
            enrolled_map.setdefault(gid, [])
        member_stmt = (
            select(GroupMember, Athlete)
            .join(Athlete, Athlete.id == GroupMember.athlete_id)
            .where(
                GroupMember.group_id.in_(group_ids),
                GroupMember.is_active.is_(True),
            )
        )
        for member, athlete in (await session.execute(member_stmt)).all():
            entry = {
                "athlete_id": str(athlete.id),
                "athlete_name": " ".join(
                    p
                    for p in (athlete.last_name, athlete.first_name, (athlete.middle_name or ""))
                    if p
                ),
                "rank": athlete.rank,
                "status": None,
                "record_id": None,
                "absence_reason": None,
            }
            enrolled_map.setdefault(str(member.group_id), []).append(entry)

        record_stmt = select(Attendance).where(
            Attendance.date == d,
            Attendance.schedule_id.in_(schedule_ids),
        )
        records = list((await session.execute(record_stmt)).scalars().all())
        record_map = {
            (str(r.athlete_id), str(r.schedule_id)): r for r in records
        }

        items = []
        for s in schedules:
            group = groups_map.get(str(s.group_id))
            if not group:
                continue
            period = period_map.get(str(s.period_id)) if s.period_id else None
            coach_id = period.coach_id if period else (s.coach_id or None)
            coach_name = None
            coach = coaches_map.get(str(coach_id)) if coach_id else None
            if coach and coach.user_id:
                user = users_map.get(str(coach.user_id))
                if user:
                    coach_name = (
                        " ".join(
                            p
                            for p in (user.last_name, user.first_name, (user.middle_name or ""))
                            if p
                        )
                        or user.first_name
                    )
            athletes = [
                {
                    **entry,
                    "status": record_map[
                        (entry["athlete_id"], str(s.id))
                    ].status
                    if (entry["athlete_id"], str(s.id)) in record_map
                    else None,
                    "record_id": str(record_map[(entry["athlete_id"], str(s.id))].id)
                    if (entry["athlete_id"], str(s.id)) in record_map
                    else None,
                    "absence_reason": record_map[
                        (entry["athlete_id"], str(s.id))
                    ].absence_reason
                    if (entry["athlete_id"], str(s.id)) in record_map
                    else None,
                }
                for entry in enrolled_map.get(str(s.group_id), [])
            ]
            items.append({
                "schedule_id": str(s.id),
                "group_id": str(s.group_id),
                "group_name": group.name,
                "discipline": group.sport_type,
                "coach_name": coach_name,
                "room": s.room,
                "location": s.location,
                "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
                "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
                "athletes": athletes,
            })
        items.sort(key=lambda i: (i["start_time"], i["group_name"]))
        return items

    # ── stats / heatmap / today / qr ─────────────────────────

    async def get_stats(self, today: date | None = None) -> dict:
        today = today or date.today()
        weekday = today.weekday()
        week_start = today - timedelta(days=weekday)
        month_start = today.replace(day=1)
        yesterday = today - timedelta(days=1)
        prev_week_start = week_start - timedelta(days=7)

        async def rate_for(start: date, end: date) -> float:
            total_stmt = select(func.count()).select_from(
                select(Attendance.status)
                .where(Attendance.date.between(start, end))
                .subquery()
            )
            total = (await self.repo.session.execute(total_stmt)).scalar() or 0
            present_stmt = select(func.count()).select_from(
                select(Attendance.status)
                .where(
                    Attendance.date.between(start, end),
                    Attendance.status == "present",
                )
                .subquery()
            )
            present = (await self.repo.session.execute(present_stmt)).scalar() or 0
            return round((present / total * 100) if total else 0, 1)

        async def absences_for(start: date, end: date) -> int:
            stmt = select(func.count()).select_from(
                select(Attendance.status)
                .where(
                    Attendance.date.between(start, end),
                    Attendance.status == "absent",
                )
                .subquery()
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
        result = await self.list_by_date(
            date_from=start, date_to=end, per_page=100000,
        )
        daily: dict[date, dict] = {}
        for item in result["items"]:
            d = date.fromisoformat(item["date"])
            if d not in daily:
                daily[d] = {"present": 0, "total": 0}
            daily[d]["total"] += 1
            if item["status"] == "present":
                daily[d]["present"] += 1

        output = []
        for i in range(days):
            d = start + timedelta(days=i)
            info = daily.get(d)
            rate = round(
                (info["present"] / info["total"] * 100) if info and info["total"] else 0, 1
            )
            output.append({"date": d.isoformat(), "rate": rate})
        return output

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
                select(GroupMember)
                .where(
                    GroupMember.group_id == group.id,
                    GroupMember.is_active.is_(True),
                )
                .subquery()
            )
            enrolled = (await self.repo.session.execute(enrolled_stmt)).scalar() or 0

            present_stmt = select(func.count()).select_from(
                select(Attendance)
                .where(
                    Attendance.schedule_id == schedule.id,
                    Attendance.date == today_date,
                    Attendance.status == "present",
                )
                .subquery()
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

        group_id = None
        if qr.schedule_id:
            schedule = await self.schedule_repo.get(str(qr.schedule_id))
            group_id = str(schedule.group_id) if schedule and schedule.group_id else None

        att = Attendance(
            id=str(uuid.uuid4()),
            athlete_id=athlete_id,
            schedule_id=qr.schedule_id,
            group_id=group_id,
            date=date.today(),
            status="present",
            check_in_time=datetime.now().time(),
            check_in_method="qr",
        )
        session.add(att)
        await session.flush()
        return att
