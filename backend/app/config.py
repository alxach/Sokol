from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_JWT_SECRETS = {"", "change-me-in-production", "test-secret-key"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "СОКОЛ API"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "sokol"
    DB_PASSWORD: str = "sokol"
    DB_NAME: str = "sokol"
    DATABASE_URL: str | None = None

    @property
    def db_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        if not self.DEBUG and self.JWT_SECRET_KEY in INSECURE_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET_KEY is not secure. Set a strong value via .env "
                "(DEBUG=True allows the default only for local development)."
            )
        return self


settings = Settings()
