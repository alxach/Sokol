from app.repositories import ReportRepository, ReportTemplateRepository
from app.schemas.report import ReportCreate, ReportTemplateCreate


class ReportService:
    def __init__(
        self, template_repo: ReportTemplateRepository,
        report_repo: ReportRepository,
    ) -> None:
        self.template_repo = template_repo
        self.report_repo = report_repo

    async def create_template(self, data: ReportTemplateCreate):
        return await self.template_repo.create(**data.model_dump())

    async def list_templates(self):
        templates, _ = await self.template_repo.list()
        return templates

    async def create(self, data: ReportCreate):
        return await self.report_repo.create(**data.model_dump())

    async def list_reports(self, page: int = 1, per_page: int = 50, center_id: str | None = None):
        return await self.report_repo.list(page=page, per_page=per_page, center_id=center_id)
