"""add schedule_periods and link schedules to periods

Revision ID: ccddee0110ff
Revises: aabbccdd0101
Create Date: 2026-08-29 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "ccddee0110ff"
down_revision: str | None = "aabbccdd0101"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "schedule_periods",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("coach_id", sa.Uuid(), nullable=True),
        sa.Column("center_id", sa.Uuid(), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["center_id"], ["centers.id"]),
        sa.ForeignKeyConstraint(["coach_id"], ["coaches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "schedules",
        sa.Column("period_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_schedules_period_id",
        "schedules",
        "schedule_periods",
        ["period_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_schedules_period_id", "schedules", type_="foreignkey")
    op.drop_column("schedules", "period_id")
    op.drop_table("schedule_periods")
