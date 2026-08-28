from pydantic import BaseModel, EmailStr, Field


class UserCreateRequest(BaseModel):
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=6)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: str | None = None
    role_codes: list[str] = Field(..., min_length=1)
    center_id: str | None = None


class UserUpdateRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = Field(None, min_length=10, max_length=20)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    middle_name: str | None = None
    is_active: bool | None = None
    center_id: str | None = None


class UserAssignRolesRequest(BaseModel):
    role_codes: list[str] = Field(..., min_length=1)


class RoleCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)


class RoleUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)


class ResetPasswordResponse(BaseModel):
    user_id: str
    temporary_password: str


class RoleOut(BaseModel):
    id: str
    code: str
    name: str
    is_system: bool = False


class UserOut(BaseModel):
    id: str
    email: str
    phone: str
    first_name: str
    last_name: str
    middle_name: str | None
    avatar_url: str | None
    is_active: bool
    center_id: str | None
    roles: list[RoleOut]
    created_at: str


class UserListResponse(BaseModel):
    data: list[UserOut]
    meta: dict
    error: None = None
