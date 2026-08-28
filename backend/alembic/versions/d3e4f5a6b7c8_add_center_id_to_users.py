"""add center_id to users

Revision ID: d3e4f5a6b7c8
Revises: c7d8e9f0a1b2
Create Date: 2026-08-27 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "d3e4f5a6b7c8"
down_revision: str | Sequence[str] | None = "c7d8e9f0a1b2"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("center_id", UUID(as_uuid=True), sa.ForeignKey("centers.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_users_center_id", "users", ["center_id"])


def downgrade() -> None:
    op.drop_index("ix_users_center_id", table_name="users")
    op.drop_column("users", "center_id")
