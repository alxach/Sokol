"""add level, city to events

Revision ID: aabbccdd0101
Revises: f5a6b7c8d9e0
Create Date: 2026-08-28 18:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "aabbccdd0101"
down_revision: str | None = "f5a6b7c8d9e0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("events", sa.Column("level", sa.String(length=30), nullable=True))
    op.add_column("events", sa.Column("city", sa.String(length=150), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "city")
    op.drop_column("events", "level")