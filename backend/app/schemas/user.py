from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    phone: str
    password: str
    first_name: str
    last_name: str
    middle_name: str | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    phone: str
    first_name: str
    last_name: str
    middle_name: str | None
    avatar_url: str | None
    is_active: bool
    roles: list[str]


class RoleCreate(BaseModel):
    code: str
    name: str
    description: str | None = None


class RoleResponse(BaseModel):
    id: str
    code: str
    name: str
    description: str | None
    is_system: bool
