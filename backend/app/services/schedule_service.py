from datetime import date

from sqlalchemy import select

from app.models.coach import Coach, CoachSickLeave, CoachVacation
from app.models.group import Group
from app.models.schedule import Schedule, SchedulePeriod
from app.models.user import User
from app.repositories import SchedulePeriodRepository, ScheduleRepository
from app.schemas.schedule import (
    ScheduleItemCreate,
    ScheduleItemUpdate,
    SchedulePeriodCreate,
    SchedulePeriodUpdate,
)


class ScheduleService:
    def __init__(
        self,
        schedule_repo: ScheduleRepository,
        period_repo: SchedulePeriodRepository,
    ) -> None:
        self.schedule_repo = schedule_repo
        self.period_repo = period_repo

    async def create(self, data) -> object:
        return await self.schedule_repo.create(**data.model_dump())

    async def list_by_group(self, group_id: str):
        schedules, _ = await self.schedule_repo.list(group_id=group_id)
        return schedules

    async def delete(self, schedule_id: str):
        return await self.schedule_repo.delete(schedule_id)

    async def _period_snapshot(
        self,
        period: SchedulePeriod,
        groups: dict[str, Group],
        coaches: dict[str, Coach],
        coach_names: dict[str, str],
        vac_by_coach: dict[str, list[CoachVacation]],
        sick_by_coach: dict[str, list[CoachSickLeave]],
    ) -> dict:
        group = groups.get(str(period.group_id)) if period.group_id else None
        coach = coaches.get(str(period.coach_id)) if period.coach_id else None
        vacs = vac_by_coach.get(str(period.coach_id), [])
        sicks = sick_by_coach.get(str(period.coach_id), [])
        return {
            "id": str(period.id),
            "group_id": str(period.group_id) if period.group_id else None,
            "coach_id": str(period.coach_id) if period.coach_id else None,
            "center_id": (
                str(period.center_id or group.center_id)
                if period.center_id or (group and group.center_id)
                else None
            ),
            "group_name": group.name if group else None,
            "coach_name": coach_names.get(str(period.coach_id)),
            "coach_user_id": str(coach.user_id) if coach else None,
            "discipline": group.sport_type if group else None,
            "period_start": period.period_start,
            "period_end": period.period_end,
            "status": period.status,
            "created_at": period.created_at.isoformat() if period.created_at else None,
            "absences": [
                {"type": "vacation", "start_date": v.start_date, "end_date": v.end_date}
                for v in vacs
            ]
            + [
                {"type": "sick", "start_date": s.start_date, "end_date": s.end_date}
                for s in sicks
            ],
        }

    async def _enrich_periods(
        self,
        periods: list[SchedulePeriod],
        counts: dict[str, int],
    ) -> list[dict]:
        if not periods:
            return []
        group_ids = {str(p.group_id) for p in periods if p.group_id}
        coach_ids = {str(p.coach_id) for p in periods if p.coach_id}
        groups = {}
        coaches = {}
        coach_names: dict[str, str] = {}
        vac_by_coach: dict[str, list[CoachVacation]] = {}
        sick_by_coach: dict[str, list[CoachSickLeave]] = {}
        session = self.period_repo.session
        if group_ids:
            result = await session.execute(select(Group).where(Group.id.in_(group_ids)))
            groups = {str(g.id): g for g in result.scalars()}
        if coach_ids:
            result = await session.execute(select(Coach).where(Coach.id.in_(coach_ids)))
            coaches = {str(c.id): c for c in result.scalars()}
            user_ids = {c.user_id for c in coaches.values() if c.user_id}
            if user_ids:
                users = await session.execute(select(User).where(User.id.in_(user_ids)))
                users_map = {str(u.id): u for u in users.scalars()}
            else:
                users_map = {}
            for c in coaches.values():
                u = users_map.get(str(c.user_id)) if c.user_id else None
                if u:
                    coach_names[str(c.id)] = (
                        " ".join(p for p in (u.last_name, u.first_name, u.middle_name or "") if p)
                        or str(u.first_name)
                    )
            result = await session.execute(
                select(CoachVacation).where(CoachVacation.coach_id.in_(coach_ids))
            )
            for v in result.scalars():
                vac_by_coach.setdefault(str(v.coach_id), []).append(v)
            result = await session.execute(
                select(CoachSickLeave).where(CoachSickLeave.coach_id.in_(coach_ids))
            )
            for s in result.scalars():
                sick_by_coach.setdefault(str(s.coach_id), []).append(s)
        snapshots = []
        for p in periods:
            snap = await self._period_snapshot(
                p, groups, coaches, coach_names, vac_by_coach, sick_by_coach
            )
            snap["lesson_count"] = counts.get(str(p.id), 0)
            snapshots.append(snap)
        return snapshots

    async def _list_items_by_period(self, period_ids: list[str]) -> dict[str, list[Schedule]]:
        if not period_ids:
            return {}
        stmt = select(Schedule).where(Schedule.period_id.in_(period_ids))
        result = await self.schedule_repo.session.execute(stmt)
        items: dict[str, list[Schedule]] = {}
        for s in result.scalars():
            key = str(s.period_id) if s.period_id else None
            if key:
                items.setdefault(key, []).append(s)
        return items

    async def create_period(self, data: SchedulePeriodCreate) -> dict:
        group = await self.period_repo.session.get(Group, data.group_id)
        if not group:
            raise ValueError("Группа не найдена")
        period = await self.period_repo.create(
            group_id=data.group_id,
            coach_id=str(group.coach_id) if group.coach_id else None,
            center_id=str(group.center_id) if group.center_id else None,
            period_start=data.period_start,
            period_end=data.period_end,
            status="draft",
        )
        counts = {str(period.id): 0}
        result = await self._enrich_periods([period], counts)
        return result[0]

    async def list_periods(
        self,
        group_id: str | None = None,
        coach_user_id: str | None = None,
        center_id: str | None = None,
        status: str | None = None,
        page: int = 1,
        per_page: int = 200,
    ) -> dict:
        session = self.period_repo.session
        stmt = select(SchedulePeriod)
        if group_id:
            stmt = stmt.where(SchedulePeriod.group_id == group_id)
        if status:
            stmt = stmt.where(SchedulePeriod.status == status)
        if coach_user_id:
            stmt = stmt.join(Coach, Coach.id == SchedulePeriod.coach_id).where(
                Coach.user_id == coach_user_id
            )
        if center_id:
            stmt = stmt.where(SchedulePeriod.center_id == center_id)
        result = await session.execute(stmt)
        periods = list(result.scalars())
        counts: dict[str, int] = {}
        items_map = await self._list_items_by_period([str(p.id) for p in periods])
        for pid, items in items_map.items():
            counts[pid] = len(items)
        snapshots = await self._enrich_periods(periods, counts)
        for snap in snapshots:
            pid = snap["id"]
            snap["items"] = [
                {
                    "id": str(s.id),
                    "day_of_week": s.day_of_week,
                    "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
                    "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
                    "room": s.room,
                    "location": s.location,
                }
                for s in items_map.get(pid, [])
            ]
        return {"items": snapshots, "total": len(snapshots), "page": page, "per_page": per_page}

    async def get_period(self, period_id: str) -> dict:
        period = await self.period_repo.get(period_id)
        if not period:
            return None
        counts, items_map = {}, {}
        items_map = await self._list_items_by_period([period_id])
        counts[period_id] = len(items_map.get(period_id, []))
        snapshots = await self._enrich_periods([period], counts)
        period_view = snapshots[0]
        period_view["items"] = [
            {
                "id": str(s.id),
                "day_of_week": s.day_of_week,
                "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
                "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
                "room": s.room,
                "location": s.location,
            }
            for s in items_map.get(period_id, [])
        ]
        return period_view

    async def update_period(self, period_id: str, data: SchedulePeriodUpdate) -> dict | None:
        period = await self.period_repo.get(period_id)
        if not period:
            return None
        kwargs = data.model_dump(exclude_unset=True)
        if not kwargs:
            return await self.get_period(period_id)
        has_start = kwargs.get("period_start")
        has_end = kwargs.get("period_end")
        if has_start and has_end and has_start > has_end:
            raise ValueError("Дата окончания раньше даты начала")
        period = await self.period_repo.update(period_id, **kwargs)
        counts = {str(period.id): 0}
        items_map = await self._list_items_by_period([period_id])
        counts[period_id] = len(items_map.get(period_id, []))
        result = await self._enrich_periods([period], counts)
        return result[0]

    async def archive_period(self, period_id: str) -> bool:
        period = await self.period_repo.get(period_id)
        if not period:
            return False
        period.status = "archived"
        await self.period_repo.session.flush()
        return True

    async def approve_period(self, period_id: str) -> dict | None:
        period = await self.period_repo.get(period_id)
        if not period:
            return None
        if period.status == "archived":
            raise ValueError("Архивный период нельзя утвердить")
        other_active = await self._active_periods_for_group(
            period.group_id, exclude_id=period_id
        )
        for other in other_active:
            other.status = "archived"
        period.status = "active"
        await self.period_repo.session.flush()
        counts = {str(period.id): 0}
        items_map = await self._list_items_by_period([period_id])
        counts[period_id] = len(items_map.get(period_id, []))
        result = await self._enrich_periods([period], counts)
        return result[0]

    async def duplicate_period(self, period_id: str) -> dict | None:
        period = await self.period_repo.get(period_id)
        if not period:
            return None
        new_start = date(
            period.period_start.year + 1, period.period_start.month, period.period_start.day
        )
        new_end = date(period.period_end.year + 1, period.period_end.month, period.period_end.day)
        new_period = await self.period_repo.create(
            group_id=period.group_id,
            coach_id=period.coach_id,
            center_id=period.center_id,
            period_start=new_start,
            period_end=new_end,
            status="draft",
        )
        items = await self._list_items_by_period([period_id])
        for source in items.get(period_id, []):
            await self.schedule_repo.create(
                period_id=str(new_period.id),
                group_id=period.group_id,
                center_id=period.center_id,
                coach_id=period.coach_id,
                day_of_week=source.day_of_week,
                start_time=source.start_time,
                end_time=source.end_time,
                room=source.room,
                location=source.location,
            )
        counts = {str(new_period.id): len(items.get(period_id, []))}
        result = await self._enrich_periods([new_period], counts)
        return result[0]

    async def create_item(self, period_id: str, data: ScheduleItemCreate) -> dict:
        period = await self.period_repo.get(period_id)
        if not period:
            raise ValueError("Период не найден")
        if period.status == "archived":
            raise ValueError("Архивный период нельзя изменять")
        schedule = await self.schedule_repo.create(
            period_id=str(period.id),
            group_id=str(period.group_id),
            coach_id=str(period.coach_id) if period.coach_id else None,
            center_id=str(period.center_id) if period.center_id else None,
            day_of_week=data.day_of_week,
            start_time=data.start_time,
            end_time=data.end_time,
            room=data.room,
        )
        return {
            "id": str(schedule.id),
            "day_of_week": schedule.day_of_week,
            "start_time": schedule.start_time.strftime("%H:%M"),
            "end_time": schedule.end_time.strftime("%H:%M"),
            "room": schedule.room,
            "location": schedule.location,
        }

    async def update_item(self, schedule_id: str, data: ScheduleItemUpdate) -> dict | None:
        schedule = await self.schedule_repo.get(schedule_id)
        if not schedule:
            return None
        if schedule.period_id:
            period = await self.period_repo.get(str(schedule.period_id))
            if period and period.status == "archived":
                raise ValueError("Архивный период нельзя изменять")
        kwargs = data.model_dump(exclude_unset=True)
        schedule = await self.schedule_repo.update(schedule_id, **kwargs)
        return {
            "id": str(schedule.id),
            "day_of_week": schedule.day_of_week,
            "start_time": schedule.start_time.strftime("%H:%M"),
            "end_time": schedule.end_time.strftime("%H:%M"),
            "room": schedule.room,
            "location": schedule.location,
        }

    async def delete_item(self, schedule_id: str) -> bool:
        schedule = await self.schedule_repo.get(schedule_id)
        if not schedule:
            return False
        if schedule.period_id:
            period = await self.period_repo.get(str(schedule.period_id))
            if period and period.status == "archived":
                raise ValueError("Архивный период нельзя изменять")
        return await self.schedule_repo.delete(schedule_id)

    async def _active_periods_for_group(
        self, group_id, exclude_id: str
    ) -> list[SchedulePeriod]:
        stmt = select(SchedulePeriod).where(
            SchedulePeriod.group_id == group_id,
            SchedulePeriod.status == "active",
            SchedulePeriod.id != exclude_id,
        )
        result = await self.period_repo.session.execute(stmt)
        return list(result.scalars())
