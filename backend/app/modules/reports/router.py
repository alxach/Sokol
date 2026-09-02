from fastapi import APIRouter, Depends

from app.core.dependencies import CurrentUser, require_roles
from app.dependencies import get_report_service
from app.schemas.report import ReportActionRequest, ReportCreate, ReportTemplateCreate, ReportUpdate
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
    coach_user_id: str | None = None,
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    author_id = coach_user_id if coach_user_id else None
    if "coach" in user.roles and not user.has_any_role("admin", "director", "superadmin"):
        return await service.list_reports(page, per_page, author_id=user.id)
    if "admin" in user.roles and not user.has_any_role("director", "superadmin"):
        forced_center = await service.accessible_center(user)
        if not forced_center:
            return [], 0
        return await service.list_reports(
            page, per_page, center_id=forced_center, author_id=author_id,
        )
    return await service.list_reports(page, per_page, center_id=center_id, author_id=author_id)


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    report = await service.get(report_id)
    await service.ensure_can_access(report, user)
    return await service.to_response(report)


@router.patch("/{report_id}")
async def update_report(
    report_id: str,
    data: ReportUpdate,
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    return await service.update(report_id, data, user)


@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    return await service.delete(report_id, user)


@router.post("/{report_id}/submit")
async def submit_report(
    report_id: str,
    body: ReportActionRequest | None = None,
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    report = await service.get(report_id)
    await service.ensure_can_access(report, user)
    comment = body.comment if body else None
    return await service.submit(report_id, user.id, comment)


@router.post("/{report_id}/redraft")
async def redraft_report(
    report_id: str,
    user: CurrentUser = Depends(require_roles("coach", "admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    return await service.redraft(report_id, user)


@router.post("/{report_id}/approve", dependencies=[Depends(require_roles("admin", "director"))])
async def approve_report(
    report_id: str,
    body: ReportActionRequest | None = None,
    user: CurrentUser = Depends(require_roles("admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    report = await service.get(report_id)
    await service.ensure_can_access(report, user)
    return await service.review(report_id, user.id, "approved", body.comment if body else None)


@router.post("/{report_id}/reject", dependencies=[Depends(require_roles("admin", "director"))])
async def reject_report(
    report_id: str,
    body: ReportActionRequest | None = None,
    user: CurrentUser = Depends(require_roles("admin", "director")),
    service: ReportService = Depends(get_report_service),
):
    report = await service.get(report_id)
    await service.ensure_can_access(report, user)
    return await service.review(report_id, user.id, "rejected", body.comment if body else None)
