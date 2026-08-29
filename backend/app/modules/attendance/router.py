from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user_id, require_roles
from app.dependencies import get_attendance_service
from app.schemas.attendance import (
    AttendanceBatch,
    AttendanceMark,
    AttendanceUpdate,
    QRGenerateRequest,
    QRScanRequest,
)
from app.services.attendance_service import AttendanceService

router = APIRouter(
    prefix="/attendance",
    tags=["attendance"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


def _not_found():
    return HTTPException(status_code=404, detail="Attendance record not found")


def _bad_request(exc: ValueError):
    return HTTPException(status_code=422, detail=str(exc))


@router.post("/mark")
async def mark_attendance(
    data: AttendanceMark,
    user_id: str = Depends(get_current_user_id),
    service: AttendanceService = Depends(get_attendance_service),
):
    try:
        return await service.mark(data, checked_by=user_id)
    except ValueError as exc:
        raise _bad_request(exc)


@router.post("/batch")
async def batch_mark(
    data: AttendanceBatch,
    user_id: str = Depends(get_current_user_id),
    service: AttendanceService = Depends(get_attendance_service),
):
    try:
        return await service.batch_mark(data, checked_by=user_id)
    except ValueError as exc:
        raise _bad_request(exc)


@router.patch("/{record_id}")
async def update_attendance(
    record_id: str,
    data: AttendanceUpdate,
    service: AttendanceService = Depends(get_attendance_service),
):
    try:
        result = await service.update(record_id, data)
    except ValueError as exc:
        raise _bad_request(exc)
    if not result:
        raise _not_found()
    return result


@router.delete("/{record_id}")
async def delete_attendance(
    record_id: str,
    service: AttendanceService = Depends(get_attendance_service),
):
    ok = await service.delete(record_id)
    if not ok:
        raise _not_found()
    return {"ok": True}


@router.get("")
async def list_attendance(
    date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    group_id: str | None = None,
    coach_user_id: str | None = None,
    center_id: str | None = None,
    page: int = 1,
    per_page: int = 200,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.list_by_date(
        date_value=date,
        date_from=date_from,
        date_to=date_to,
        group_id=group_id,
        coach_user_id=coach_user_id,
        center_id=center_id,
        page=page,
        per_page=per_page,
    )


@router.get("/journal")
async def attendance_journal(
    date: str,
    coach_user_id: str | None = None,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.journal(date, coach_user_id=coach_user_id)


@router.get("/stats")
async def attendance_stats(
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.get_stats()


@router.get("/stats/heatmap")
async def attendance_heatmap(
    days: int = 28,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.get_heatmap(days)


@router.get("/today")
async def today_trainings(
    coach_id: str | None = None,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.get_today_trainings(coach_id)


@router.post("/qr/generate")
async def generate_qr(
    data: QRGenerateRequest,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.generate_qr(data)


@router.post("/qr/scan")
async def scan_qr(
    data: QRScanRequest,
    service: AttendanceService = Depends(get_attendance_service),
):
    try:
        return await service.scan_qr(data.qr_code, data.athlete_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
