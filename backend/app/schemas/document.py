from pydantic import BaseModel


class DocumentCreate(BaseModel):
    template_id: str
    file_url: str | None = None
    # author_id берётся из токена в роутере; content_json — содержимое документа.
    content_json: dict = {}
    status: str = "draft"
