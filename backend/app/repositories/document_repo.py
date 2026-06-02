from app.models.document import Document, DocumentApproval, DocumentTemplate
from app.repositories.base import BaseRepository


class DocumentTemplateRepository(BaseRepository[DocumentTemplate]):
    def __init__(self, session):
        super().__init__(session, DocumentTemplate)


class DocumentRepository(BaseRepository[Document]):
    def __init__(self, session):
        super().__init__(session, Document)


class DocumentApprovalRepository(BaseRepository[DocumentApproval]):
    def __init__(self, session):
        super().__init__(session, DocumentApproval)
