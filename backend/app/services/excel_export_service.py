from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete import Athlete
from app.models.attendance import Attendance
from app.models.coach import Coach
from app.models.event import Event
from app.models.group import Group
from app.models.user import User
from app.services.excel_service import (
    export_athletes_to_excel,
    export_attendance_to_excel,
    export_coaches_to_excel,
    export_events_to_excel,
)

EXPORT_TYPES = ("athletes", "coaches", "attendance", "events")


class ExcelExportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def export(self, export_type: str) -> tuple[bytes | object, str]:
        if export_type not in EXPORT_TYPES:
            raise ValueError(f"Неизвестный тип экспорта: {export_type}")
        today = date.today()
        handler = {
            "athletes": self._athletes,
            "coaches": self._coaches,
            "attendance": self._attendance,
            "events": self._events,
        }[export_type]
        buf = await handler()
        return buf, f"{export_type}_{today.isoformat()}.xlsx"

    async def _athletes(self):
        result = await self.session.execute(select(Athlete))
        rows = [
            {
                "id": str(a.id),
                "first_name": a.first_name,
                "last_name": a.last_name,
                "middle_name": a.middle_name,
                "gender": a.gender,
                "birth_date": str(a.birth_date) if a.birth_date else "",
                "sport_type": a.sport_type,
                "rank": a.rank,
                "status": a.status,
                "center_id": str(a.center_id) if a.center_id else "",
            }
            for a in result.scalars().all()
        ]
        return export_athletes_to_excel(rows)

    async def _coaches(self):
        stmt = select(Coach, User).join(User, Coach.user_id == User.id, isouter=True)
        rows = [
            {
                "first_name": user.first_name if user else "",
                "last_name": user.last_name if user else "",
                "middle_name": user.middle_name if user else "",
                "specialization": coach.specialization,
                "center_id": str(coach.center_id) if coach.center_id else "",
                "hire_date": str(coach.hire_date) if coach.hire_date else "",
                "is_active": coach.is_active,
            }
            for coach, user in (await self.session.execute(stmt)).all()
        ]
        return export_coaches_to_excel(rows)

    async def _attendance(self):
        stmt = (
            select(Attendance, Athlete, Group)
            .join(Athlete, Attendance.athlete_id == Athlete.id, isouter=True)
            .join(Group, Attendance.group_id == Group.id, isouter=True)
        )
        rows = [
            {
                "athlete_name": " ".join(
                    p for p in (athlete.last_name, athlete.first_name, athlete.middle_name or "") if p
                ) if athlete else "",
                "date": str(att.date) if att.date else "",
                "status": att.status,
                "schedule_info": group.name if group else "",
            }
            for att, athlete, group in (await self.session.execute(stmt)).all()
        ]
        return export_attendance_to_excel(rows)

    async def _events(self):
        result = await self.session.execute(select(Event))
        rows = [
            {
                "id": str(e.id),
                "name": e.name,
                "event_type": e.event_type,
                "start_date": str(e.start_date) if e.start_date else "",
                "end_date": str(e.end_date) if e.end_date else "",
                "location": e.location,
                "status": e.status,
            }
            for e in result.scalars().all()
        ]
        return export_events_to_excel(rows)
