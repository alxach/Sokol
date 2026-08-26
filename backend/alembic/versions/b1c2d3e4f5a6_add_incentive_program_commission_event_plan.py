"""add incentive program, commission protocol, event plan, extend center and report

Revision ID: b1c2d3e4f5a6
Revises: aa4b60334ee5
Create Date: 2026-07-14 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: str | Sequence[str] | None = 'aa4b60334ee5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Extend centers table
    op.add_column('centers', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('centers', sa.Column('center_type', sa.String(length=50), server_default='cse', nullable=False))

    # 2. Create incentive_programs table
    op.create_table('incentive_programs',
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('regulation_number', sa.String(length=50), nullable=False),
        sa.Column('regulation_date', sa.Date(), nullable=False),
        sa.Column('revision', sa.Integer(), nullable=False),
        sa.Column('max_payout', sa.Integer(), server_default='50000', nullable=False),
        sa.Column('min_payout', sa.Integer(), server_default='25000', nullable=False),
        sa.Column('ndfl_rate', sa.Numeric(5, 2), server_default='13.00', nullable=False),
        sa.Column('insurance_rate', sa.Numeric(5, 2), server_default='30.20', nullable=False),
        sa.Column('is_discretionary', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('regulation_number'),
    )

    # 3. Create commission_protocols table
    op.create_table('commission_protocols',
        sa.Column('number', sa.String(length=50), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('beneficiary_name', sa.String(length=500), nullable=False),
        sa.Column('period', sa.String(length=50), nullable=False),
        sa.Column('center_id', sa.UUID(), sa.ForeignKey('centers.id'), nullable=False),
        sa.Column('agenda', sa.Text(), nullable=True),
        sa.Column('decisions', sa.Text(), nullable=True),
        sa.Column('voting_for', sa.Integer(), server_default='0', nullable=False),
        sa.Column('voting_against', sa.Integer(), server_default='0', nullable=False),
        sa.Column('voting_abstained', sa.Integer(), server_default='0', nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # 4. Create payout_rows table
    op.create_table('payout_rows',
        sa.Column('protocol_id', sa.UUID(), sa.ForeignKey('commission_protocols.id', ondelete='CASCADE'), nullable=False),
        sa.Column('coach_id', sa.UUID(), sa.ForeignKey('coaches.id'), nullable=False),
        sa.Column('report_id', sa.UUID(), sa.ForeignKey('reports.id'), nullable=True),
        sa.Column('sport_type', sa.String(length=100), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('gross_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('ndfl_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('insurance_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('net_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # 5. Create event_plans table
    op.create_table('event_plans',
        sa.Column('coach_id', sa.UUID(), sa.ForeignKey('coaches.id'), nullable=False),
        sa.Column('center_id', sa.UUID(), sa.ForeignKey('centers.id'), nullable=False),
        sa.Column('program_id', sa.UUID(), sa.ForeignKey('incentive_programs.id'), nullable=True),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
        sa.Column('reviewer_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('review_comment', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # 6. Create plan_items table
    op.create_table('plan_items',
        sa.Column('plan_id', sa.UUID(), sa.ForeignKey('event_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(length=5), nullable=False),
        sa.Column('quarter', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('date', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('location', sa.String(length=500), nullable=True),
        sa.Column('participants_category', sa.String(length=500), nullable=True),
        sa.Column('participants_count', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
        sa.Column('reviewer_comment', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # 7. Extend reports table
    op.add_column('reports', sa.Column('program_id', sa.UUID(), sa.ForeignKey('incentive_programs.id'), nullable=True))
    op.add_column('reports', sa.Column('payout_tier', sa.Integer(), nullable=True))
    op.add_column('reports', sa.Column('commission_protocol_id', sa.UUID(), sa.ForeignKey('commission_protocols.id'), nullable=True))

    # 8. Seed CSE centers (11 from Appendix 1)
    op.execute("""
        INSERT INTO centers (id, name, city, address, center_type, is_active, created_at, updated_at)
        VALUES
            (gen_random_uuid(), 'Центр спортивных единоборств г. Ачинска', 'Ачинск', '662161, Красноярский край, г. Ачинск, ул. Кравченко, 30', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Братска', 'Братск', '665717, Иркутская обл., г. Братск, ул. Комсомольская, 35б', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Волгограда', 'Волгоград', '400009, Волгоградская область, г. Волгоград, ул. Таращанцев, 72', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Дивногорска', 'Дивногорск', '663090, Красноярский край, г. Дивногорск, ул. Спортивная, 2б', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Краснотурьинска', 'Краснотурьинск', '624447, Свердловская область, г. Краснотурьинск, ул. Бульвар Мира 13а', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Красноярска', 'Красноярск', '660119, Красноярский край, г. Красноярск, пр. 60 лет Образования СССР, 17а', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Саяногорска', 'Саяногорск', '655603, Республика Хакасия, г. Саяногорск, м-н Центральный, 45', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Североуральска', 'Североуральск', '624481, Свердловская область, г. Североуральск, ул. Буденного, 37', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Тайшета', 'Тайшет', '665002, Иркутская область, г. Тайшет, ул. Пушкина, 25', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Усть-Илимска', 'Усть-Илимск', '666684, Иркутская область, г. Усть-Илимск, ул. Федотова, 4а/2', 'cse', true, now(), now()),
            (gen_random_uuid(), 'Центр спортивных единоборств г. Шелехова', 'Шелехов', '666036, Иркутская область, г. Шелехов, 3 микрорайон, 44', 'cse', true, now(), now())
    """)

    # 9. Seed IncentiveProgram (v8)
    op.execute("""
        INSERT INTO incentive_programs (id, name, regulation_number, regulation_date, revision, max_payout, min_payout, ndfl_rate, insurance_rate, is_discretionary, status, created_at, updated_at)
        VALUES
            (gen_random_uuid(), 'Положение о порядке материального стимулирования тренеров', 'ЦСиЗ-26-П022', '2026-07-09', 8, 50000, 25000, 13.00, 30.20, true, 'active', now(), now())
    """)


def downgrade() -> None:
    op.drop_column('reports', 'commission_protocol_id')
    op.drop_column('reports', 'payout_tier')
    op.drop_column('reports', 'program_id')
    op.drop_table('plan_items')
    op.drop_table('event_plans')
    op.drop_table('payout_rows')
    op.drop_table('commission_protocols')
    op.drop_table('incentive_programs')
    op.drop_column('centers', 'center_type')
    op.drop_column('centers', 'city')
