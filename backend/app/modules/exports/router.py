from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db as get_session
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

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/excel/{export_type}")
async def export_excel(
    export_type: str,
    session: AsyncSession = Depends(get_session),
):
    today = date.today()

    if export_type == "athletes":
        stmt = select(Athlete)
        result = await session.execute(stmt)
        athletes = result.scalars().all()
        data = []
        for a in athletes:
            item = {
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
            data.append(item)
        buf = export_athletes_to_excel(data)
        filename = f"sporstmeny_{today.isoformat()}.xlsx"

    elif export_type == "coaches":
        stmt = (
            select(Coach, User)
            .join(User, Coach.user_id == User.id, isouter=True)
        )
        result = await session.execute(stmt)
        rows = result.all()
        data = []
        for coach, user in rows:
            data.append({
                "first_name": user.first_name if user else "",
                "last_name": user.last_name if user else "",
                "middle_name": user.middle_name if user else "",
                "specialization": coach.specialization,
                "center_id": str(coach.center_id) if coach.center_id else "",
                "hire_date": str(coach.hire_date) if coach.hire_date else "",
                "is_active": coach.is_active,
            })
        buf = export_coaches_to_excel(data)
        filename = f"trenery_{today.isoformat()}.xlsx"

    elif export_type == "attendance":
        stmt = (
            select(Attendance, Athlete, Group)
            .join(Athlete, Attendance.athlete_id == Athlete.id, isouter=True)
            .join(Group, Attendance.group_id == Group.id, isouter=True)
        )
        result = await session.execute(stmt)
        rows = result.all()
        data = []
        for att, athlete, group in rows:
            data.append({
                "athlete_name": f"{athlete.last_name} {athlete.first_name}" if athlete else "",
                "date": str(att.date) if att.date else "",
                "status": att.status,
                "schedule_info": group.name if group else "",
            })
        buf = export_attendance_to_excel(data)
        filename = f"poseshaemost_{today.isoformat()}.xlsx"

    elif export_type == "events":
        stmt = select(Event)
        result = await session.execute(stmt)
        events = result.scalars().all()
        data = []
        for e in events:
            data.append({
                "id": str(e.id),
                "name": e.name,
                "event_type": e.event_type,
                "start_date": str(e.start_date) if e.start_date else "",
                "end_date": str(e.end_date) if e.end_date else "",
                "location": e.location,
                "status": e.status,
            })
        buf = export_events_to_excel(data)
        filename = f"sobytiya_{today.isoformat()}.xlsx"

    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Неизвестный тип: {export_type}")

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
