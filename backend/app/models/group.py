import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.schedule import Schedule


class Group(TimestampMixin, Base):
    __tablename__ = "groups"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=True,
    )
    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id", ondelete="SET NULL"), nullable=True,
    )
    sport_type: Mapped[str] = mapped_column(String(100), nullable=False)
    age_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    skill_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    max_capacity: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    schedule_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan",
    )
    schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="group", cascade="all, delete-orphan",
    )


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True,
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id", ondelete="CASCADE"), primary_key=True,
    )
    join_date: Mapped[Date] = mapped_column(Date, nullable=False)
    leave_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    group: Mapped["Group"] = relationship(back_populates="members")
