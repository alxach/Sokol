from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select

from app.models import Center, Coach, User
from app.repositories import (
    ReportRepository,
    ReportSubmissionRepository,
    ReportTemplateRepository,
)
from app.schemas.report import (
    ReportCreate,
    ReportResponse,
    ReportTemplateCreate,
    ReportUpdate,
)

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

    @property
    def session(self):
        return self.report_repo.session

    # ── Templates ──────────────────────────────────────────────────────────
    async def create_template(self, data: ReportTemplateCreate):
        return await self.template_repo.create(**data.model_dump())

    async def list_templates(self):
        templates, _ = await self.template_repo.list()
        return templates

    # ── CRUD ───────────────────────────────────────────────────────────────
    async def create(self, data: ReportCreate, author_id: str) -> ReportResponse:
        payload = data.model_dump(exclude_unset=False)
        payload["author_id"] = author_id
        if not payload.get("coach_id"):
            coach = (
                await self.session.execute(select(Coach).where(Coach.user_id == author_id))
            ).scalar_one_or_none()
            if coach:
                payload["coach_id"] = str(coach.id)
                if not payload.get("center_id"):
                    payload["center_id"] = str(coach.center_id) if coach.center_id else None
        instance = await self.report_repo.create(status="draft", **payload)
        return await self.to_response(instance)

    async def list_reports(
        self,
        page: int = 1,
        per_page: int = 50,
        center_id: str | None = None,
        author_id: str | None = None,
    ):
        items, total = await self.report_repo.list(
            page=page, per_page=per_page, center_id=center_id, author_id=author_id,
        )
        return [await self.to_response(r) for r in items], total

    async def get(self, report_id: str):
        report = await self.report_repo.get(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report

    async def update(
        self, report_id: str, data: ReportUpdate, user,
    ) -> ReportResponse:
        report = await self.get(report_id)
        if "coach" in user.roles and str(report.author_id) != user.id:
            raise HTTPException(status_code=403, detail="Coach can edit only own reports")
        if report.status != "draft":
            raise HTTPException(status_code=422, detail="Only draft reports can be edited")
        fields = {
            key: value
            for key, value in data.model_dump().items()
            if value is not None and key in data.model_fields_set
        }
        updated = await self.report_repo.update(report_id, **fields)
        await self.session.refresh(updated)
        return await self.to_response(updated)

    async def delete(self, report_id: str, user) -> dict:
        report = await self.get(report_id)
        if "coach" in user.roles and str(report.author_id) != user.id:
            raise HTTPException(status_code=403, detail="Coach can delete only own reports")
        if report.status != "draft":
            raise HTTPException(status_code=422, detail="Only draft reports can be deleted")
        await self.report_repo.delete(report_id)
        return {"ok": True}

    # ── Workflow ───────────────────────────────────────────────────────────
    async def _transition(self, report_id: str, target: str, user_id: str, comment: str | None):
        report = await self.get(report_id)
        allowed = ALLOWED_TRANSITIONS.get(report.status, set())
        if target not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid transition {report.status} -> {target}",
            )
        extra: dict = {}
        if target == "submitted":
            extra["payout_tier"] = await self._compute_payout(
                str(report.template_id), report.data_json,
            )
        updated = await self.report_repo.update(
            report_id,
            status=target,
            reviewer_id=user_id if target in {"approved", "rejected"} else None,
            review_comment=comment if target in {"approved", "rejected"} else None,
            reviewed_at=datetime.now(UTC) if target in {"approved", "rejected"} else None,
            **extra,
        )
        await self.session.refresh(updated)
        await self.submission_repo.create(
            report_id=report_id, submitted_by=user_id, status=target, comment=comment,
        )
        return await self.to_response(updated)

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

    # ── Payout (v8, Приложение №6) ─────────────────────────────────────────
    async def _compute_payout(self, template_id: str, data_json: dict) -> int | None:
        template = await self.template_repo.get(template_id)
        if not template:
            return None
        fields = (template.structure_json or {}).get("fields", [])
        numeric = [
            f for f in fields
            if f.get("type") == "number"
            and (f.get("normFull") is not None or f.get("normBasic") is not None)
        ]
        if not numeric:
            return None

        def _all_meet(attr: str) -> bool:
            for f in numeric:
                try:
                    value = float(data_json.get(f["key"], 0) or 0)
                except (TypeError, ValueError):
                    return False
                if value < float(f[attr]):
                    return False
            return True

        if all(f.get("normFull") is not None for f in numeric) and _all_meet("normFull"):
            return 50000
        if all(f.get("normBasic") is not None for f in numeric) and _all_meet("normBasic"):
            return 25000
        return 0

    # ── Enrich ─────────────────────────────────────────────────────────────
    async def to_response(self, report) -> ReportResponse:
        response = ReportResponse.model_validate(report)
        template = await self.template_repo.get(str(report.template_id))
        response.template_name = template.name if template else None

        if report.coach_id:
            coach = (
                await self.session.execute(select(Coach).where(Coach.id == report.coach_id))
            ).scalar_one_or_none()
            if coach:
                response.sport = coach.specialization
                if coach.user_id:
                    user_row = (
                        await self.session.execute(
                            select(User).where(User.id == coach.user_id)
                        )
                    ).scalar_one_or_none()
                    if user_row:
                        response.coach_name = self._full_name(user_row)
                        response.coach_user_id = str(user_row.id)

        if not response.coach_name:
            author = (
                await self.session.execute(
                    select(User).where(User.id == report.author_id)
                )
            ).scalar_one_or_none()
            if author:
                response.author_name = self._full_name(author)

        if report.center_id:
            center = (
                await self.session.execute(select(Center).where(Center.id == report.center_id))
            ).scalar_one_or_none()
            if center:
                response.center_name = center.name
                response.center_city = center.city or ""
        return response

    @staticmethod
    def _full_name(user_row: User) -> str:
        return " ".join(
            p for p in (user_row.last_name, user_row.first_name, user_row.middle_name or "") if p
        ) or "—"
