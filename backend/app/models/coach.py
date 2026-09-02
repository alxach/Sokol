import uuid

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin


class Coach(TimestampMixin, Base):
    __tablename__ = "coaches"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False,
    )
    center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=True,
    )
    specialization: Mapped[str] = mapped_column(String(200), nullable=False)
    qualification: Mapped[str | None] = mapped_column(String(100), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    hire_date: Mapped[Date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    incentive_tier: Mapped[str | None] = mapped_column(String(10), nullable=True)

    categories: Mapped[list["CoachCategory"]] = relationship(
        back_populates="coach", cascade="all, delete-orphan",
    )
    vacations: Mapped[list["CoachVacation"]] = relationship(
        back_populates="coach", cascade="all, delete-orphan",
    )
    sick_leaves: Mapped[list["CoachSickLeave"]] = relationship(
        back_populates="coach", cascade="all, delete-orphan",
    )


class CoachCategory(TimestampMixin, Base):
    __tablename__ = "coach_categories"

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=False,
    )
    category_name: Mapped[str] = mapped_column(String(100), nullable=False)
    certified_at: Mapped[Date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[Date | None] = mapped_column(Date, nullable=True)
    document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    coach: Mapped["Coach"] = relationship(back_populates="categories")


class CoachVacation(TimestampMixin, Base):
    __tablename__ = "coach_vacations"

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=False,
    )
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=False)

    coach: Mapped["Coach"] = relationship(back_populates="vacations")


class CoachSickLeave(TimestampMixin, Base):
    __tablename__ = "coach_sick_leaves"

    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=False,
    )
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=False)

    coach: Mapped["Coach"] = relationship(back_populates="sick_leaves")
