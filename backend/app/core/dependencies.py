from dataclasses import dataclass, field

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)

SUPERADMIN = "superadmin"


@dataclass
class CurrentUser:
    id: str
    roles: list[str] = field(default_factory=list)

    def has_any_role(self, *allowed: str) -> bool:
        return bool(set(self.roles) & set(allowed))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_token(credentials.credentials)
    sub = payload.get("sub")
    if not sub or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return CurrentUser(id=str(sub), roles=list(payload.get("roles") or []))


async def get_current_user_id(
    user: CurrentUser = Depends(get_current_user),
) -> str:
    return user.id


def require_roles(*allowed: str):
    """Dependency factory: 401 without valid token, 403 when role is not allowed."""

    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if SUPERADMIN in user.roles or user.has_any_role(*allowed):
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return checker
