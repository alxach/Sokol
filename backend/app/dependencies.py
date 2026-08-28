from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db as get_session
from app.repositories import (
    AthleteAchievementRepository,
    AthleteDocumentRepository,
    AthleteMedicalRepository,
    AthleteRankHistoryRepository,
    AthleteRepository,
    AttendanceRepository,
    CenterRepository,
    CoachRepository,
    CommissionProtocolRepository,
    CompetitionRepository,
    DocumentApprovalRepository,
    DocumentRepository,
    DocumentTemplateRepository,
    EventPlanRepository,
    EventRepository,
    GroupMemberRepository,
    GroupRepository,
    IncentiveCriteriaRepository,
    IncentiveProgramRepository,
    ParticipantRepository,
    PayoutRowRepository,
    PlanItemRepository,
    RegionRepository,
    ReportRepository,
    ReportSubmissionRepository,
    ReportTemplateRepository,
    ResultRepository,
    ScheduleRepository,
)
from app.services.athlete_service import AthleteService
from app.services.attendance_service import AttendanceService
from app.services.coach_service import CoachService
from app.services.document_service import DocumentService
from app.services.event_service import EventService
from app.services.group_service import GroupService
from app.services.incentive_service import IncentiveService
from app.services.organization_service import OrganizationService
from app.services.report_service import ReportService
from app.services.schedule_service import ScheduleService


async def get_organization_service(
    session: AsyncSession = Depends(get_session),
) -> OrganizationService:
    return OrganizationService(RegionRepository(session), CenterRepository(session))


async def get_athlete_service(session: AsyncSession = Depends(get_session)) -> AthleteService:
    return AthleteService(
        AthleteRepository(session),
        AthleteDocumentRepository(session),
        AthleteMedicalRepository(session),
        AthleteAchievementRepository(session),
        AthleteRankHistoryRepository(session),
    )


async def get_coach_service(session: AsyncSession = Depends(get_session)) -> CoachService:
    return CoachService(CoachRepository(session))


async def get_group_service(session: AsyncSession = Depends(get_session)) -> GroupService:
    return GroupService(GroupRepository(session), GroupMemberRepository(session))


async def get_schedule_service(session: AsyncSession = Depends(get_session)) -> ScheduleService:
    return ScheduleService(ScheduleRepository(session))


async def get_attendance_service(session: AsyncSession = Depends(get_session)) -> AttendanceService:
    return AttendanceService(AttendanceRepository(session))


async def get_event_service(session: AsyncSession = Depends(get_session)) -> EventService:
    return EventService(
        EventRepository(session),
        CompetitionRepository(session),
        ParticipantRepository(session),
        ResultRepository(session),
    )


async def get_report_service(session: AsyncSession = Depends(get_session)) -> ReportService:
    return ReportService(
        ReportTemplateRepository(session),
        ReportRepository(session),
        ReportSubmissionRepository(session),
    )


async def get_document_service(
    session: AsyncSession = Depends(get_session),
) -> DocumentService:
    return DocumentService(
        DocumentTemplateRepository(session),
        DocumentRepository(session),
        DocumentApprovalRepository(session),
    )


async def get_incentive_service(session: AsyncSession = Depends(get_session)) -> IncentiveService:
    return IncentiveService(
        IncentiveProgramRepository(session),
        EventPlanRepository(session),
        PlanItemRepository(session),
        CommissionProtocolRepository(session),
        PayoutRowRepository(session),
        CoachRepository(session),
        CenterRepository(session),
        IncentiveCriteriaRepository(session),
    )
