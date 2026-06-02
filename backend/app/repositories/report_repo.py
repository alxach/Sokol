from app.models.report import Report, ReportSubmission, ReportTemplate
from app.repositories.base import BaseRepository


class ReportTemplateRepository(BaseRepository[ReportTemplate]):
    def __init__(self, session):
        super().__init__(session, ReportTemplate)


class ReportRepository(BaseRepository[Report]):
    def __init__(self, session):
        super().__init__(session, Report)


class ReportSubmissionRepository(BaseRepository[ReportSubmission]):
    def __init__(self, session):
        super().__init__(session, ReportSubmission)
