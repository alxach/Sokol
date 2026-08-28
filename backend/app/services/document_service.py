from app.repositories import (
    DocumentApprovalRepository,
    DocumentRepository,
    DocumentTemplateRepository,
)
from app.schemas.document import DocumentCreate


class DocumentService:
    def __init__(
        self,
        template_repo: DocumentTemplateRepository,
        document_repo: DocumentRepository,
        approval_repo: DocumentApprovalRepository,
    ) -> None:
        self.template_repo = template_repo
        self.document_repo = document_repo
        self.approval_repo = approval_repo

    async def list_templates(self):
        templates, _ = await self.template_repo.list()
        return templates

    async def create_document(self, data: DocumentCreate, author_id: str):
        return await self.document_repo.create(author_id=author_id, **data.model_dump())

    async def list_documents(self, page: int = 1, per_page: int = 50):
        return await self.document_repo.list(page=page, per_page=per_page)

    async def approve(
        self, document_id: str, user_id: str,
        decision: str, comment: str | None = None,
    ):
        return await self.approval_repo.create(
            document_id=document_id,
            approver_id=user_id,
            action=decision,
            comment=comment,
            step_order=0,
        )
