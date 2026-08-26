import uuid

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin


class Event(TimestampMixin, Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("start_date <= end_date", name="ck_events_date_range"),
    )

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    center_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=True,
    )
    organizer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=False)
    location: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planned", nullable=False)

    competitions: Mapped[list["Competition"]] = relationship(
        back_populates="event", cascade="all, delete-orphan",
    )


class Competition(TimestampMixin, Base):
    __tablename__ = "competitions"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    discipline: Mapped[str] = mapped_column(String(100), nullable=False)
    age_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    weight_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    competition_type: Mapped[str] = mapped_column(String(50), nullable=False)
    max_participants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="planned", nullable=False)

    event: Mapped["Event"] = relationship(back_populates="competitions")
    participants: Mapped[list["Participant"]] = relationship(
        back_populates="competition", cascade="all, delete-orphan",
    )
    results: Mapped[list["Result"]] = relationship(
        back_populates="competition", cascade="all, delete-orphan",
    )


class Participant(TimestampMixin, Base):
    __tablename__ = "participants"
    __table_args__ = (
        UniqueConstraint("competition_id", "athlete_id", name="uq_participant_per_competition"),
    )

    competition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False,
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id"), nullable=False,
    )
    status: Mapped[str] = mapped_column(String(20), default="registered", nullable=False)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_at_registration: Mapped[str | None] = mapped_column(String(20), nullable=True)

    competition: Mapped["Competition"] = relationship(back_populates="participants")


class Result(TimestampMixin, Base):
    __tablename__ = "results"
    __table_args__ = (
        UniqueConstraint("competition_id", "athlete_id", "stage", name="uq_result_per_competition_stage"),
    )

    competition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False,
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("athletes.id"), nullable=False,
    )
    participant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.id"), nullable=True,
    )
    stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[str | None] = mapped_column(String(50), nullable=True)
    result_value: Mapped[str | None] = mapped_column(String(50), nullable=True)
    medal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    competition: Mapped["Competition"] = relationship(back_populates="results")
