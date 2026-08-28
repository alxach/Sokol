from fastapi import APIRouter, Depends

from app.core.dependencies import CurrentUser, get_current_user, require_roles
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
    user: CurrentUser = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    return await service.create_document(data, author_id=str(user.id))


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
    user: CurrentUser = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    return await service.approve(document_id, str(user.id), decision, comment)
