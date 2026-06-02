from pydantic import BaseModel


class DocumentCreate(BaseModel):
    template_id: str
    athlete_id: str | None = None
    title: str
    file_url: str | None = None
    status: str = "draft"
