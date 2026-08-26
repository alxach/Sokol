from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import require_roles
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


@router.post("/mark")
async def mark_attendance(
    data: AttendanceMark,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.mark(data)


@router.post("/batch")
async def batch_mark(
    data: AttendanceBatch,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.batch_mark(data)


@router.patch("/{record_id}")
async def update_attendance(
    record_id: str,
    data: AttendanceUpdate,
    service: AttendanceService = Depends(get_attendance_service),
):
    result = await service.update(record_id, data)
    if not result:
        raise HTTPException(404, "Attendance record not found")
    return result


@router.get("")
async def list_attendance(
    date: str,
    group_id: str | None = None,
    page: int = 1,
    per_page: int = 50,
    service: AttendanceService = Depends(get_attendance_service),
):
    return await service.list_by_date(date, group_id)


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
