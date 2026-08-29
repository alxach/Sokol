import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.group import Group


class SchedulePeriod(TimestampMixin, Base):
    __tablename__ = "schedule_periods"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False,
    )
    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id", ondelete="SET NULL"), nullable=True,
    )
    center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=True,
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)

    group: Mapped["Group"] = relationship(back_populates="schedule_periods")
    schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="period", cascade="all, delete-orphan",
    )


class Schedule(TimestampMixin, Base):
    __tablename__ = "schedules"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="ck_schedules_day_of_week"),
        CheckConstraint("start_time < end_time", name="ck_schedules_time_range"),
    )

    period_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedule_periods.id", ondelete="CASCADE"),
        nullable=True,
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=True,
    )
    center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=True,
    )
    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=True,
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[Time] = mapped_column(Time, nullable=False)
    end_time: Mapped[Time] = mapped_column(Time, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)

    group: Mapped["Group"] = relationship(back_populates="schedules")
    period: Mapped["SchedulePeriod"] = relationship(back_populates="schedules")
