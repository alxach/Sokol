__all__ = [
    "RegionRepository",
    "CenterRepository",
    "AthleteRepository",
    "AthleteDocumentRepository",
    "AthleteMedicalRepository",
    "AthleteAchievementRepository",
    "AthleteRankHistoryRepository",
    "CoachRepository",
    "GroupRepository",
    "GroupMemberRepository",
    "ScheduleRepository",
    "AttendanceRepository",
    "EventRepository",
    "CompetitionRepository",
    "ParticipantRepository",
    "ResultRepository",
    "ReportTemplateRepository",
    "ReportRepository",
    "ReportSubmissionRepository",
    "DocumentTemplateRepository",
    "DocumentRepository",
    "DocumentApprovalRepository",
]

from app.repositories.athlete_repo import (
    AthleteAchievementRepository,
    AthleteDocumentRepository,
    AthleteMedicalRepository,
    AthleteRankHistoryRepository,
    AthleteRepository,
)
from app.repositories.attendance_repo import AttendanceRepository
from app.repositories.coach_repo import CoachRepository
from app.repositories.document_repo import (
    DocumentApprovalRepository,
    DocumentRepository,
    DocumentTemplateRepository,
)
from app.repositories.event_repo import (
    CompetitionRepository,
    EventRepository,
    ParticipantRepository,
    ResultRepository,
)
from app.repositories.group_repo import GroupMemberRepository, GroupRepository
from app.repositories.organization_repo import CenterRepository, RegionRepository
from app.repositories.report_repo import (
    ReportRepository,
    ReportSubmissionRepository,
    ReportTemplateRepository,
)
from app.repositories.schedule_repo import ScheduleRepository
