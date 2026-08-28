"""add incentive_criteria table

Revision ID: f5a6b7c8d9e0
Revises: e1f2a3b4c5d6
Create Date: 2026-08-28 14:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "f5a6b7c8d9e0"
down_revision: str | Sequence[str] | None = "e1f2a3b4c5d6"


def upgrade() -> None:
    op.create_table(
        "incentive_criteria",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "center_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "updated_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("athletes_full", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("athletes_basic", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("hours_full", sa.Numeric(4, 1), nullable=False, server_default="9.0"),
        sa.Column("hours_basic", sa.Numeric(4, 1), nullable=False, server_default="4.5"),
        sa.Column("social_events_full", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("social_events_basic", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sports_events_full", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sports_events_basic", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("development_events_full", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("development_events_basic", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("center_id", name="uq_incentive_criteria_center"),
    )


def downgrade() -> None:
    op.drop_table("incentive_criteria")