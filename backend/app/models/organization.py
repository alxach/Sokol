import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin


class Region(TimestampMixin, Base):
    __tablename__ = "regions"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)

    centers: Mapped[list["Center"]] = relationship(back_populates="region")


class Center(TimestampMixin, Base):
    __tablename__ = "centers"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    region_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("regions.id"), nullable=True,
    )
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    center_type: Mapped[str] = mapped_column(String(50), default="cse", nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    region: Mapped[Region | None] = relationship(back_populates="centers")
