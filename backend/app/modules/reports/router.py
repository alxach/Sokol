from fastapi import APIRouter, Depends

from app.core.dependencies import CurrentUser, require_roles
from app.dependencies import get_report_service
from app.schemas.report import ReportActionRequest, ReportCreate, ReportTemplateCreate
from app.services.report_service import ReportService

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


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
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    return await service.create(data, user.id)


@router.get("")
async def list_reports(
    page: int = 1,
    per_page: int = 50,
    center_id: str | None = None,
    service: ReportService = Depends(get_report_service),
):
    return await service.list_reports(page, per_page, center_id)


@router.post("/{report_id}/submit")
async def submit_report(
    report_id: str,
    body: ReportActionRequest | None = None,
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    comment = body.comment if body else None
    return await service.submit(report_id, user.id, comment)


@router.post("/{report_id}/approve", dependencies=[Depends(require_roles("admin", "director"))])
async def approve_report(
    report_id: str,
    body: ReportActionRequest | None = None,
    user: CurrentUser = Depends(require_roles("admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    return await service.review(report_id, user.id, "approved", body.comment if body else None)


@router.post("/{report_id}/reject", dependencies=[Depends(require_roles("admin", "director"))])
async def reject_report(
    report_id: str,
    body: ReportActionRequest | None = None,
    user: CurrentUser = Depends(require_roles("admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    return await service.review(report_id, user.id, "rejected", body.comment if body else None)
