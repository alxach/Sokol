from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.database import get_db
from app.models.audit import AuditLog

router = APIRouter(
    prefix="/audit-logs",
    tags=["audit"],
    dependencies=[Depends(require_roles("admin", "director"))],
)


@router.get("")
async def list_audit_logs(
    resource: str | None = Query(None),
    action: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())

    if resource:
        stmt = stmt.where(AuditLog.resource == resource)
    if action:
        stmt = stmt.where(AuditLog.action == action)

    total = len((await db.execute(stmt)).scalars().all())
    offset = (page - 1) * per_page
    result = await db.execute(stmt.offset(offset).limit(per_page))
    items = result.scalars().all()

    return {
        "data": [
            {
                "id": str(item.id),
                "user_id": str(item.user_id),
                "action": item.action,
                "resource": item.resource,
                "resource_id": item.resource_id,
                "old_value": item.old_value,
                "new_value": item.new_value,
                "ip_address": item.ip_address,
                "created_at": item.created_at.isoformat(),
            }
            for item in items
        ],
        "meta": {"page": page, "per_page": per_page, "total": total},
        "error": None,
    }
