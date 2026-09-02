import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin


class CommissionProtocol(TimestampMixin, Base):
    __tablename__ = "commission_protocols"

    number: Mapped[str] = mapped_column(String(50), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    beneficiary_name: Mapped[str] = mapped_column(String(500), nullable=False)
    period: Mapped[str] = mapped_column(String(50), nullable=False)
    center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id"), nullable=False,
    )
    agenda: Mapped[str | None] = mapped_column(Text, nullable=True)
    decisions: Mapped[str | None] = mapped_column(Text, nullable=True)
    voting_for: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    voting_against: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    voting_abstained: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    payout_rows: Mapped[list["PayoutRow"]] = relationship(
        back_populates="protocol", cascade="all, delete-orphan",
    )


class PayoutRow(TimestampMixin, Base):
    __tablename__ = "payout_rows"

    protocol_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("commission_protocols.id", ondelete="CASCADE"),
        nullable=False,
    )
    coach_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaches.id"), nullable=False,
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id"), nullable=True,
    )
    sport_type: Mapped[str] = mapped_column(String(100), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    ndfl_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    insurance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    protocol: Mapped["CommissionProtocol"] = relationship(back_populates="payout_rows")
