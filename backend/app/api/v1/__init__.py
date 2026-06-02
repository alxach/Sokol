from fastapi import APIRouter

from app.modules.analytics.router import router as analytics_router
from app.modules.athletes.router import router as athletes_router
from app.modules.attendance.router import router as attendance_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.coaches.router import router as coaches_router
from app.modules.documents.router import router as documents_router
from app.modules.events.router import router as events_router
from app.modules.exports.router import router as exports_router
from app.modules.groups.router import router as groups_router
from app.modules.organizations.router import router as organizations_router
from app.modules.reports.router import router as reports_router
from app.modules.schedules.router import router as schedules_router
from app.modules.users.router import router as users_router

router = APIRouter(prefix="/api/v1")

router.include_router(analytics_router)
router.include_router(athletes_router)
router.include_router(attendance_router)
router.include_router(audit_router)
router.include_router(auth_router)
router.include_router(coaches_router)
router.include_router(documents_router)
router.include_router(events_router)
router.include_router(exports_router)
router.include_router(groups_router)
router.include_router(organizations_router)
router.include_router(reports_router)
router.include_router(schedules_router)
router.include_router(users_router)


@router.get("/health")
async def health():
    return {"status": "ok"}
