import uuid

from sqlalchemy import Boolean, Date, ForeignKey, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, TimestampMixin


class Attendance(TimestampMixin, Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("athlete_id", "schedule_id", "date", name="uq_attendance_per_class"),
    )

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id"), nullable=False,
    )
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=True,
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=True,
    )
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    check_in_time: Mapped[Time | None] = mapped_column(Time, nullable=True)
    absence_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    check_in_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    checked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )


class AttendanceQRCode(TimestampMixin, Base):
    __tablename__ = "attendance_qr_codes"

    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=True,
    )
    qr_code: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    valid_date: Mapped[Date] = mapped_column(Date, nullable=False)
    valid_from: Mapped[Time] = mapped_column(Time, nullable=False)
    valid_until: Mapped[Time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
