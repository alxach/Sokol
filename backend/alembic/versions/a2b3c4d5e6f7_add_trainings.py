"""add trainings table

Revision ID: a2b3c4d5e6f7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-02 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trainings",
        sa.Column("center_id", sa.UUID(), sa.ForeignKey("centers.id"), nullable=False),
        sa.Column("coach_id", sa.UUID(), sa.ForeignKey("coaches.id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("location", sa.String(length=500), nullable=False),
        sa.Column("participants_count", sa.Integer(), nullable=True),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="proposed", nullable=False),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan_item_id", sa.UUID(), sa.ForeignKey("plan_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trainings_center_date", "trainings", ["center_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_trainings_center_date", table_name="trainings")
    op.drop_table("trainings")