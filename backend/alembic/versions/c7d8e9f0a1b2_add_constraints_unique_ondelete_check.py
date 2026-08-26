"""add constraints: UNIQUE, ON DELETE, CHECK

Revision ID: c7d8e9f0a1b2
Revises: b1c2d3e4f5a6
Create Date: 2026-07-15 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c7d8e9f0a1b2"
down_revision: str | Sequence[str] | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # === 1. UNIQUE constraints ===

    # attendance: one mark per athlete per schedule per date
    op.create_unique_constraint(
        "uq_attendance_per_class",
        "attendance",
        ["athlete_id", "schedule_id", "date"],
    )

    # participants: one registration per athlete per competition
    op.create_unique_constraint(
        "uq_participant_per_competition",
        "participants",
        ["competition_id", "athlete_id"],
    )

    # results: one result per athlete per competition per stage
    op.create_unique_constraint(
        "uq_result_per_competition_stage",
        "results",
        ["competition_id", "athlete_id", "stage"],
    )

    # === 2. ON DELETE constraints ===
    # PostgreSQL requires drop + recreate to change ON DELETE on existing FKs.

    # 2a. centers → athletes.center_id  (RESTRICT)
    op.execute(
        "ALTER TABLE athletes DROP CONSTRAINT IF EXISTS athletes_center_id_fkey"
    )
    op.create_foreign_key(
        "athletes_center_id_fkey",
        "athletes",
        "centers",
        ["center_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # 2b. centers → coaches.center_id  (RESTRICT)
    op.execute(
        "ALTER TABLE coaches DROP CONSTRAINT IF EXISTS coaches_center_id_fkey"
    )
    op.create_foreign_key(
        "coaches_center_id_fkey",
        "coaches",
        "centers",
        ["center_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # 2c. centers → groups.center_id  (RESTRICT)
    op.execute(
        "ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_center_id_fkey"
    )
    op.create_foreign_key(
        "groups_center_id_fkey",
        "groups",
        "centers",
        ["center_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # 2d. centers → events.center_id  (RESTRICT)
    op.execute(
        "ALTER TABLE events DROP CONSTRAINT IF EXISTS events_center_id_fkey"
    )
    op.create_foreign_key(
        "events_center_id_fkey",
        "events",
        "centers",
        ["center_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # 2e. coaches → athletes.coach_id  (SET NULL)
    op.execute(
        "ALTER TABLE athletes DROP CONSTRAINT IF EXISTS athletes_coach_id_fkey"
    )
    op.create_foreign_key(
        "athletes_coach_id_fkey",
        "athletes",
        "coaches",
        ["coach_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # === 3. CHECK constraints ===

    # schedules: day_of_week 1-7
    op.create_check_constraint(
        "ck_schedules_day_of_week",
        "schedules",
        "day_of_week BETWEEN 1 AND 7",
    )

    # schedules: start_time < end_time
    op.create_check_constraint(
        "ck_schedules_time_range",
        "schedules",
        "start_time < end_time",
    )

    # events: start_date <= end_date
    op.create_check_constraint(
        "ck_events_date_range",
        "events",
        "start_date <= end_date",
    )


def downgrade() -> None:
    # Drop CHECK constraints
    op.drop_constraint("ck_events_date_range", "events", type_="check")
    op.drop_constraint("ck_schedules_time_range", "schedules", type_="check")
    op.drop_constraint("ck_schedules_day_of_week", "schedules", type_="check")

    # Restore original FKs (no ON DELETE)
    op.execute(
        "ALTER TABLE athletes DROP CONSTRAINT IF EXISTS athletes_coach_id_fkey"
    )
    op.create_foreign_key(
        "athletes_coach_id_fkey",
        "athletes",
        "coaches",
        ["coach_id"],
        ["id"],
    )

    op.execute(
        "ALTER TABLE events DROP CONSTRAINT IF EXISTS events_center_id_fkey"
    )
    op.create_foreign_key(
        "events_center_id_fkey",
        "events",
        "centers",
        ["center_id"],
        ["id"],
    )

    op.execute(
        "ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_center_id_fkey"
    )
    op.create_foreign_key(
        "groups_center_id_fkey",
        "groups",
        "centers",
        ["center_id"],
        ["id"],
    )

    op.execute(
        "ALTER TABLE coaches DROP CONSTRAINT IF EXISTS coaches_center_id_fkey"
    )
    op.create_foreign_key(
        "coaches_center_id_fkey",
        "coaches",
        "centers",
        ["center_id"],
        ["id"],
    )

    op.execute(
        "ALTER TABLE athletes DROP CONSTRAINT IF EXISTS athletes_center_id_fkey"
    )
    op.create_foreign_key(
        "athletes_center_id_fkey",
        "athletes",
        "centers",
        ["center_id"],
        ["id"],
    )

    # Drop UNIQUE constraints
    op.drop_constraint("uq_result_per_competition_stage", "results", type_="unique")
    op.drop_constraint("uq_participant_per_competition", "participants", type_="unique")
    op.drop_constraint("uq_attendance_per_class", "attendance", type_="unique")
