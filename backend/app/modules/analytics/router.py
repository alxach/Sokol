from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.dependencies import get_session
from app.services.analytics_service import AnalyticsService

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_roles("admin", "director"))],
)


@router.get("/dashboard")
async def dashboard(
    session: AsyncSession = Depends(get_session),
):
    service = AnalyticsService(session)
    return await service.get_dashboard()
