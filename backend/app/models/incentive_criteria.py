import uuid

from sqlalchemy import ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, TimestampMixin


class IncentiveCriteria(TimestampMixin, Base):
    __tablename__ = "incentive_criteria"
    __table_args__ = (
        UniqueConstraint("center_id", name="uq_incentive_criteria_center"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    athletes_full: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    athletes_basic: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    hours_full: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False, default=9.0)
    hours_basic: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False, default=4.5)
    social_events_full: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    social_events_basic: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sports_events_full: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sports_events_basic: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    development_events_full: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    development_events_basic: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
