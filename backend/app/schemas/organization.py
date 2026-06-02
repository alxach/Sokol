from pydantic import BaseModel


class RegionCreate(BaseModel):
    name: str
    code: str


class RegionResponse(BaseModel):
    id: str
    name: str
    code: str


class CenterCreate(BaseModel):
    name: str
    region_id: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None


class CenterResponse(BaseModel):
    id: str
    name: str
    region_id: str | None
    address: str | None
    phone: str | None
    email: str | None
    is_active: bool
