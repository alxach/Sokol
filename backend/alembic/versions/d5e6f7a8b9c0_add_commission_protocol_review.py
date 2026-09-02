"""add status and review fields to commission_protocols

Revision ID: d5e6f7a8b9c0
Revises: ddeeff010203
Create Date: 2026-08-29 14:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: str | Sequence[str] | None = 'ddeeff010203'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'commission_protocols',
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
    )
    op.add_column(
        'commission_protocols',
        sa.Column('reviewer_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.add_column(
        'commission_protocols',
        sa.Column('review_comment', sa.Text(), nullable=True),
    )
    op.add_column(
        'commission_protocols',
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('commission_protocols', 'reviewed_at')
    op.drop_column('commission_protocols', 'review_comment')
    op.drop_column('commission_protocols', 'reviewer_id')
    op.drop_column('commission_protocols', 'status')