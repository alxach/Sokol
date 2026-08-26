from datetime import date

from sqlalchemy import Boolean, Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, TimestampMixin


class IncentiveProgram(TimestampMixin, Base):
    __tablename__ = "incentive_programs"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    regulation_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    regulation_date: Mapped[date] = mapped_column(Date, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    max_payout: Mapped[int] = mapped_column(Integer, nullable=False, default=50000)
    min_payout: Mapped[int] = mapped_column(Integer, nullable=False, default=25000)
    ndfl_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=13.00)
    insurance_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=30.20)
    is_discretionary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
