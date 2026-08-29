"""seed monthly coach report template

Revision ID: ddeeff010203
Revises: ccddee0110ff
Create Date: 2026-08-29 12:00:00.000000

"""
import json
from collections.abc import Sequence

from alembic import op

revision: str = "ddeeff010203"
down_revision: str | None = "ccddee0110ff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TEMPLATE_ID = "11111111-2222-3333-4444-555555555555"

STRUCTURE = {
    "fields": [
        {
            "key": "athletes_count",
            "label": "Кол-во занимающихся спортсменов до 21 года на безвозмездной основе",
            "type": "number",
            "norm": "≥30 (50К) / ≥15 (25К) чел.",
            "confirmationForm": "mandatory_in_report",
            "normFull": 30,
            "normBasic": 15,
            "unit": "чел.",
        },
        {
            "key": "hours_per_week",
            "label": "Кол-во часов для занятий со спортсменами до 21 года",
            "type": "number",
            "norm": "≥9 (50К) / ≥4,5 (25К) ч/нед",
            "confirmationForm": "on_request",
            "normFull": 9,
            "normBasic": 4.5,
            "unit": "ч/нед",
        },
        {
            "key": "special_events",
            "label": "Мероприятия с особыми категориями населения (дети с ОВЗ, школы)",
            "type": "textarea",
            "norm": "Не менее 1 раза в месяц",
            "confirmationForm": "mandatory_in_report",
            "normFull": 1,
            "normBasic": 1,
            "unit": "меропр./мес",
        },
        {
            "key": "sport_events",
            "label": "Спортивные мероприятия на развитие ЦСЕ (соревнования, сборы, мастер-классы)",
            "type": "textarea",
            "norm": "Не менее 1 раза в месяц",
            "confirmationForm": "mandatory_in_report",
            "normFull": 1,
            "normBasic": 1,
            "unit": "меропр./мес",
        },
        {
            "key": "development_events",
            "label": "Мероприятия на развитие спортсменов ЦСЕ (беседы, лекции)",
            "type": "textarea",
            "norm": "Не менее 1 раза в месяц",
            "confirmationForm": "mandatory_in_report",
            "normFull": 1,
            "normBasic": 1,
            "unit": "меропр./мес",
        },
    ]
}


def upgrade() -> None:
    op.execute(
        "INSERT INTO report_templates (id, name, code, report_type, structure_json, description, "
        "is_active, created_at, updated_at) "
        f"VALUES ('{TEMPLATE_ID}', 'Основной отчёт тренера', 'monthly_coach_report', 'monthly', "
        f"'{json.dumps(STRUCTURE, ensure_ascii=False)}'::jsonb, "
        "'Ежемесячный отчёт тренера-преподавателя ЦСЕ', true, now(), now()) "
        "ON CONFLICT (code) DO NOTHING"
    )


def downgrade() -> None:
    op.execute(
        f"DELETE FROM report_templates WHERE id = '{TEMPLATE_ID}'"
    )
