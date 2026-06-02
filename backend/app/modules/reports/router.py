from fastapi import APIRouter, Depends

from app.dependencies import get_report_service
from app.schemas.report import ReportCreate, ReportTemplateCreate
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/templates")
async def create_template(
    data: ReportTemplateCreate,
    service: ReportService = Depends(get_report_service),
):
    return await service.create_template(data)


@router.get("/templates")
async def list_templates(
    service: ReportService = Depends(get_report_service),
):
    return await service.list_templates()


@router.post("")
async def create_report(
    data: ReportCreate,
    service: ReportService = Depends(get_report_service),
):
    return await service.create(data)


@router.get("")
async def list_reports(
    page: int = 1,
    per_page: int = 50,
    center_id: str | None = None,
    service: ReportService = Depends(get_report_service),
):
    return await service.list_reports(page, per_page, center_id)
