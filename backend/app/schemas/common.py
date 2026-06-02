from pydantic import BaseModel


class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    total_pages: int


class APIResponse(BaseModel):
    data: dict | list | None = None
    meta: PaginationMeta | None = None
    error: dict | None = None
