"""normalize athlete statuses to active/inactive

Revision ID: a1b2c3d4e5f6
Revises: e0f1a2b3c4d5
Create Date: 2026-09-01 09:30:00.000000

"""
from collections.abc import Sequence

from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "e0f1a2b3c4d5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Collapse legacy statuses into the single archived state 'inactive'."""
    op.execute(
        "UPDATE athletes SET status = 'inactive' "
        "WHERE status IN ('graduated', 'expelled', 'transferred')"
    )


def downgrade() -> None:
    """Downgrade is a no-op: the old status values are not recoverable."""
