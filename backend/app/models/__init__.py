from app.core.base import Base
from app.models.athlete import (
    Athlete,
    AthleteAchievement,
    AthleteDocument,
    AthleteMedical,
    AthleteRankHistory,
)
from app.models.attendance import Attendance, AttendanceQRCode
from app.models.audit import AuditLog
from app.models.coach import Coach, CoachCategory
from app.models.document import Document, DocumentApproval, DocumentTemplate
from app.models.event import Competition, Event, Participant, Result
from app.models.group import Group, GroupMember
from app.models.organization import Center, Region
from app.models.report import Report, ReportSubmission, ReportTemplate
from app.models.schedule import Schedule
from app.models.user import Permission, Role, RolePermission, User, UserRole

__all__ = [
    "Base",
    "User",
    "Role",
    "Permission",
    "UserRole",
    "RolePermission",
    "AuditLog",
    "Region",
    "Center",
    "Athlete",
    "AthleteDocument",
    "AthleteMedical",
    "AthleteRankHistory",
    "AthleteAchievement",
    "Coach",
    "CoachCategory",
    "Group",
    "GroupMember",
    "Schedule",
    "Attendance",
    "AttendanceQRCode",
    "Event",
    "Competition",
    "Participant",
    "Result",
    "ReportTemplate",
    "Report",
    "ReportSubmission",
    "DocumentTemplate",
    "Document",
    "DocumentApproval",
]
