from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select

from app.core.dependencies import CurrentUser
from app.models import Center, Coach, IncentiveProgram, User
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
    "rejected": {"submitted", "draft"},
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

    # ── Access scope ───────────────────────────────────────────────────────
    async def accessible_center(self, user) -> str | None:
        """Центр, к которому привязан пользователь.

        coach → центр его тренерской записи; admin → центр пользователя;
        director/superadmin → None (доступ ко всем отчётам).
        """
        if user.has_any_role("director", "superadmin"):
            return None
        if "admin" in user.roles:
            user_row = await self._user_row(user.id)
            return str(user_row.center_id) if user_row and user_row.center_id else None
        if "coach" in user.roles:
            coach = await self._coach_of(user.id)
            return str(coach.center_id) if coach and coach.center_id else None
        return None

    async def ensure_can_access(self, report, user) -> None:
        """Проверяет доступ к отчёту: coach — только свои, admin — только своего центра."""
        if user.has_any_role("director", "superadmin"):
            return
        if "admin" in user.roles:
            user_row = await self._user_row(user.id)
            if (
                not user_row
                or not user_row.center_id
                or str(report.center_id) != str(user_row.center_id)
            ):
                raise HTTPException(status_code=403, detail="Report belongs to another center")
            return
        if "coach" in user.roles:
            if str(report.author_id) != user.id:
                raise HTTPException(status_code=403, detail="Coach can access only own reports")
            return
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    async def _coach_of(self, user_id: str) -> Coach | None:
        return (
            await self.session.execute(select(Coach).where(Coach.user_id == user_id))
        ).scalar_one_or_none()

    async def _user_row(self, user_id: str) -> User | None:
        return (
            await self.session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()

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
        await self.ensure_can_access(report, user)
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
        await self.ensure_can_access(report, user)
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
        if target == "draft":
            report.status = "draft"
            report.reviewer_id = None
            report.review_comment = None
            report.reviewed_at = None
            report.payout_tier = None
            await self.session.flush()
            await self.session.refresh(report)
            updated = report
        else:
            extra: dict = {}
            if target == "submitted":
                extra["payout_tier"] = await self._compute_payout(report)
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

    async def redraft(
        self,
        report_id: str,
        user: CurrentUser,
    ):
        report = await self.get(report_id)
        await self.ensure_can_access(report, user)
        if str(report.author_id) != user.id and "superadmin" not in user.roles:
            raise HTTPException(status_code=403, detail="Only the author can redraft a report")
        return await self._transition(report_id, "draft", user.id, None)

    async def review(
        self, report_id: str, reviewer_id: str, decision: str, comment: str | None = None,
    ):
        if decision not in {"approved", "rejected"}:
            raise HTTPException(status_code=422, detail="Decision must be 'approved' or 'rejected'")
        if decision == "rejected" and not comment:
            raise HTTPException(status_code=422, detail="Comment is required when rejecting")
        return await self._transition(report_id, decision, reviewer_id, comment)

    # ── Payout (v8, Приложение №6) ─────────────────────────────────────────
    async def _compute_payout(self, report) -> int:
        template = await self.template_repo.get(str(report.template_id))
        if not template:
            return 0
        coach = None
        if report.coach_id:
            coach = (
                await self.session.execute(select(Coach).where(Coach.id == report.coach_id))
            ).scalar_one_or_none()
        tier = coach.incentive_tier if coach else None
        if tier not in {"full", "basic"}:
            return 0

        program = (
            await self.session.execute(
                select(IncentiveProgram)
                .where(IncentiveProgram.status == "active")
                .limit(1),
            )
        ).scalars().first()
        max_payout = program.max_payout if program else 50000
        min_payout = program.min_payout if program else 25000

        fields = (template.structure_json or {}).get("fields", [])
        numeric = [
            f for f in fields
            if f.get("type") == "number"
            and (f.get("normFull") is not None or f.get("normBasic") is not None)
        ]
        if not numeric:
            return 0

        def _all_meet(attr: str) -> bool:
            for f in numeric:
                if f.get(attr) is None:
                    return False
                try:
                    value = float((report.data_json or {}).get(f["key"], 0) or 0)
                except (TypeError, ValueError):
                    return False
                if value < float(f[attr]):
                    return False
            return True

        if tier == "full" and _all_meet("normFull"):
            return max_payout
        if tier == "basic" and _all_meet("normBasic"):
            return min_payout
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
