import uuid

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin


class Athlete(TimestampMixin, Base):
    __tablename__ = "athletes"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    birth_date: Mapped[Date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=True,
    )
    coach_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=True,
    )
    sport_type: Mapped[str] = mapped_column(String(100), nullable=False)
    rank: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rank_assign_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    rank_order_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    enrollment_type: Mapped[str] = mapped_column(String(20), default="enrolled", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    documents: Mapped[list["AthleteDocument"]] = relationship(
        back_populates="athlete", cascade="all, delete-orphan",
    )
    medical: Mapped[list["AthleteMedical"]] = relationship(
        back_populates="athlete", cascade="all, delete-orphan",
    )
    ranks: Mapped[list["AthleteRankHistory"]] = relationship(
        back_populates="athlete", cascade="all, delete-orphan",
    )
    achievements: Mapped[list["AthleteAchievement"]] = relationship(
        back_populates="athlete", cascade="all, delete-orphan",
    )


class AthleteDocument(TimestampMixin, Base):
    __tablename__ = "athlete_documents"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False,
    )
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    doc_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issue_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    expire_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )

    athlete: Mapped["Athlete"] = relationship(back_populates="documents")


class AthleteMedical(TimestampMixin, Base):
    __tablename__ = "athlete_medical"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False,
    )
    medical_type: Mapped[str] = mapped_column(String(100), nullable=False)
    examination_date: Mapped[Date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[Date] = mapped_column(Date, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    doctor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    athlete: Mapped["Athlete"] = relationship(back_populates="medical")


class AthleteRankHistory(TimestampMixin, Base):
    __tablename__ = "athlete_ranks_history"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False,
    )
    rank_before: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rank_after: Mapped[str] = mapped_column(String(50), nullable=False)
    assign_date: Mapped[Date] = mapped_column(Date, nullable=False)
    order_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    athlete: Mapped["Athlete"] = relationship(back_populates="ranks")


class AthleteAchievement(TimestampMixin, Base):
    __tablename__ = "athlete_achievements"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False,
    )
    competition_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=True,
    )
    achievement_type: Mapped[str] = mapped_column(String(50), nullable=False)
    place: Mapped[str | None] = mapped_column(String(50), nullable=True)
    medal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    athlete: Mapped["Athlete"] = relationship(back_populates="achievements")
