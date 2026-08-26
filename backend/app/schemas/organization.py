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
    city: str | None = None
    center_type: str = "cse"
    phone: str | None = None
    email: str | None = None


class CenterResponse(BaseModel):
    id: str
    name: str
    region_id: str | None
    address: str | None
    city: str | None
    center_type: str
    phone: str | None
    email: str | None
    is_active: bool
