"""add incentive_tier to coaches

Revision ID: e0f1a2b3c4d5
Revises: d5e6f7a8b9c0
Create Date: 2026-08-30 18:40:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "e0f1a2b3c4d5"
down_revision: str | Sequence[str] | None = "d5e6f7a8b9c0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "coaches", sa.Column("incentive_tier", sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("coaches", "incentive_tier")