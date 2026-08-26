from datetime import UTC, datetime

from fastapi import HTTPException

from app.repositories import (
    ReportRepository,
    ReportSubmissionRepository,
    ReportTemplateRepository,
)
from app.schemas.report import ReportCreate, ReportTemplateCreate

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"submitted"},
    "submitted": {"approved", "rejected"},
    "rejected": {"submitted"},
    "approved": set(),
}


class ReportService:
    def __init__(
        self, template_repo: ReportTemplateRepository,
        report_repo: ReportRepository,
        submission_repo: ReportSubmissionRepository,
    ) -> None:
        self.template_repo = template_repo
        self.report_repo = report_repo
        self.submission_repo = submission_repo

    async def create_template(self, data: ReportTemplateCreate):
        return await self.template_repo.create(**data.model_dump())

    async def list_templates(self):
        templates, _ = await self.template_repo.list()
        return templates

    async def create(self, data: ReportCreate, author_id: str):
        payload = data.model_dump()
        payload["author_id"] = author_id
        return await self.report_repo.create(status="draft", **payload)

    async def list_reports(self, page: int = 1, per_page: int = 50, center_id: str | None = None):
        return await self.report_repo.list(page=page, per_page=per_page, center_id=center_id)

    async def get(self, report_id: str):
        report = await self.report_repo.get(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report

    async def _transition(self, report_id: str, target: str, user_id: str, comment: str | None):
        report = await self.get(report_id)
        allowed = ALLOWED_TRANSITIONS.get(report.status, set())
        if target not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid transition {report.status} -> {target}",
            )
        updated = await self.report_repo.update(
            report_id,
            status=target,
            reviewer_id=user_id if target in {"approved", "rejected"} else None,
            review_comment=comment if target in {"approved", "rejected"} else None,
            reviewed_at=datetime.now(UTC) if target in {"approved", "rejected"} else None,
        )
        await self.submission_repo.create(
            report_id=report_id, submitted_by=user_id, status=target, comment=comment,
        )
        return updated

    async def submit(self, report_id: str, user_id: str, comment: str | None = None):
        return await self._transition(report_id, "submitted", user_id, comment)

    async def review(
        self, report_id: str, reviewer_id: str, decision: str, comment: str | None = None,
    ):
        if decision not in {"approved", "rejected"}:
            raise HTTPException(status_code=422, detail="Decision must be 'approved' or 'rejected'")
        if decision == "rejected" and not comment:
            raise HTTPException(status_code=422, detail="Comment is required when rejecting")
        return await self._transition(report_id, decision, reviewer_id, comment)
