from fastapi import APIRouter, Depends

from app.core.dependencies import require_roles
from app.dependencies import get_document_service
from app.schemas.document import DocumentCreate
from app.services.document_service import DocumentService

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    dependencies=[Depends(require_roles("coach", "admin", "director"))],
)


@router.get("/templates")
async def list_templates(
    service: DocumentService = Depends(get_document_service),
):
    return await service.list_templates()


@router.post("")
async def create_document(
    data: DocumentCreate,
    service: DocumentService = Depends(get_document_service),
):
    return await service.create_document(data)


@router.get("")
async def list_documents(
    page: int = 1,
    per_page: int = 50,
    service: DocumentService = Depends(get_document_service),
):
    return await service.list_documents(page, per_page)


@router.post("/{document_id}/approve")
async def approve_document(
    document_id: str,
    decision: str = "approved",
    comment: str | None = None,
    service: DocumentService = Depends(get_document_service),
):
    user_id = "00000000-0000-0000-0000-000000000000"
    return await service.approve(document_id, user_id, decision, comment)
