from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.database import get_db as get_session
from app.services.excel_export_service import ExcelExportService

router = APIRouter(
    prefix="/exports",
    tags=["exports"],
    dependencies=[Depends(require_roles("admin", "director"))],
)


@router.get("/excel/{export_type}")
async def export_excel(
    export_type: str,
    session: AsyncSession = Depends(get_session),
):
    service = ExcelExportService(session)
    try:
        buf, filename = await service.export(export_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
