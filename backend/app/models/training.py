import uuid
from datetime import date, time

from sqlalchemy import Date, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, TimestampMixin


class Training(TimestampMixin, Base):
    __tablename__ = "trainings"

    center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=False,
    )
    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    location: Mapped[str] = mapped_column(String(500), nullable=False)
    participants_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="proposed", nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )
    plan_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_items.id", ondelete="SET NULL"), nullable=True,
    )