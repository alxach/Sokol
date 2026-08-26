# ADR-020: Аудит схемы БД — модели ↔ спека ↔ ERD

## Status
Accepted

## Date
2026-07-15

## Context

Проведён тройной аудит соответствия базы данных проекта «СОКОЛ»:
1. **SQLAlchemy модели** (`backend/app/models/`) ↔ **schema-spec.md** (спецификация схемы)
2. **SQLAlchemy модели** ↔ **Alembic миграции** (`alembic/versions/`)
3. **SQLAlchemy модели** ↔ **ERD** (`docs/erd.md`)

Источники:
- 37 таблиц в моделях (14 файлов, 36 mapped-классов + Base)
- 6 миграций в цепочке (af1fc816 → b1c2d3e4f5a6)
- schema-spec.md (1028 строк, версия 1.0 от 29.05.2026)
- erd.md (589 строк, версия 1.0)

### Результат проверки: Модели ↔ Миграции

**Полная синхронизация.** Все 37 таблиц и их столбцы совпадают. Новая миграция не требуется для выравнивания состояния.

## Decision

### 1. Расхождения моделей со спекой (schema-spec.md)

#### 1.1. Enum-столбцы реализованы как String (13 шт.)

Все enum-столбцы определены в спеке как PostgreSQL ENUM типы (`AthleteStatus`, `AttendanceStatus`, `ReportStatus` и др.), но в моделях реализованы как `String(N)`.

| Таблица | Столбец | Спека | Модель |
|---------|---------|-------|--------|
| `athletes` | `status` | `AthleteStatus` | `String(20)` |
| `athletes` | `enrollment_type` | `EnrollmentType` | `String(20)` |
| `athlete_documents` | `doc_type` | `DocType` | `String(50)` |
| `attendance` | `status` | `AttendanceStatus` | `String(20)` |
| `attendance` | `check_in_method` | `CheckInMethod` | `String(20)` |
| `events` | `event_type` | `EventType` | `String(50)` |
| `events` | `status` | `EventStatus` | `String(20)` |
| `competitions` | `competition_type` | `CompetitionType` | `String(50)` |
| `participants` | `status` | `ParticipantStatus` | `String(20)` |
| `reports` | `status` | `ReportStatus` | `String(20)` |
| `report_submissions` | `status` | `ReportStatus` | `String(20)` |
| `documents` | `status` | `DocumentStatus` | `String(20)` |
| `document_approvals` | `action` | `ApprovalAction` | `String(20)` |

**Решение:** Оставить как `String(N)`. Преимущество: проще миграции (нет CREATE TYPE / ALTER TYPE), совместимость с любыми значениями. Список допустимых значений контролируется на уровне приложения (Pydantic-схемы, frontend-типы).

#### 1.2. Лишний `updated_at` через TimestampMixin (~17 таблиц)

TimestampMixin добавляет `updated_at` ко всем наследующим таблицам. Спека не предусматривает `updated_at` для: `roles`, `permissions`, `regions`, `athlete_documents`, `athlete_medical`, `athlete_ranks_history`, `athlete_achievements`, `coach_categories`, `attendance`, `attendance_qr_codes`, `competitions`, `participants`, `results`, `report_submissions`, `document_templates`, `document_approvals`, `audit_logs`.

**Решение:** Оставить. `updated_at` полезен для отслеживания изменений и аудита. Обновить спеку — добавить `updated_at` во все таблицы.

#### 1.3. Отсутствуют ON DELETE ограничения (5 FK)

| FK | Спека (§4.1) | Модель |
|----|-------------|--------|
| `centers → athletes.center_id` | RESTRICT | — |
| `centers → coaches.center_id` | RESTRICT | — |
| `centers → groups.center_id` | RESTRICT | — |
| `centers → events.center_id` | RESTRICT | — |
| `coaches → athletes.coach_id` | SET NULL | — |

**Решение:** Исправить через новую миграцию. ON DELETE критичен для целостности данных.

#### 1.4. Отсутствуют CHECK ограничения (3)

| Таблица | Ограничение | Спека |
|---------|-------------|-------|
| `schedules` | `CHECK (day_of_week BETWEEN 1 AND 7)` | §3.19 |
| `schedules` | `CHECK (start_time < end_time)` | §3.19 |
| `events` | `CHECK (start_date <= end_date)` | §3.22 |

**Решение:** Исправить через новую миграцию.

#### 1.5. Отсутствуют UNIQUE ограничения (3)

| Таблица | Ограничение | Спека |
|---------|-------------|-------|
| `attendance` | `UNIQUE(athlete_id, schedule_id, date)` | §3.20 |
| `participants` | `UNIQUE(competition_id, athlete_id)` | §3.24 |
| `results` | `UNIQUE(competition_id, athlete_id, stage)` | §3.25 |

**Решение:** Исправить через новую миграцию. Без UNIQUE возможны дубли записей.

#### 1.6. Столбец `participants.registered_at`

Спека определяет `registered_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Модель использует `created_at` из TimestampMixin.

**Решение:** Семантически идентично (`created_at` фиксирует момент создания записи = момент регистрации). Переименование избыточно. Обновить спеку: заменить `registered_at` на `created_at`.

#### 1.7. Тип `payout_tier` без явного типа

В модели `Report`: `mapped_column(nullable=True)` — нет указания типа `Integer`.

**Решение:** Исправить в модели, добавить явный `Integer`.

#### 1.8. Таблицы в спеке без моделей (2)

| Таблица | Статус |
|---------|--------|
| `vk_users` | Спека §3.33, модель отсутствует |
| `vk_notifications` | Спека §3.34, модель отсутствует |

**Решение:** VK Mini App запланирован в roadmap (Этап 9). Модели будут реализованы при начале разработки модуля VK. Пока что — оставить в спеке как Planned.

#### 1.9. Модели без спеки (7)

| Модель | Таблица | Источник |
|--------|---------|----------|
| `IncentiveProgram` | `incentive_programs` | ADR-019 |
| `CommissionProtocol` | `commission_protocols` | ADR-019 |
| `PayoutRow` | `payout_rows` | ADR-019 |
| `EventPlan` | `event_plans` | ADR-019 |
| `PlanItem` | `plan_items` | ADR-019 |
| `CoachVacation` | `coach_vacations` | ADR-001 |
| `CoachSickLeave` | `coach_sick_leaves` | ADR-002 |

**Решение:** Добавить все 7 таблиц в schema-spec.md и ERD.

#### 1.10. Расширения `reports` не отражены в спеке

3 столбца добавлены миграцией `b1c2d3e4f5a6`, но schema-spec.md не обновлён:
- `program_id` (UUID, FK → incentive_programs.id, nullable)
- `payout_tier` (Integer, nullable)
- `commission_protocol_id` (UUID, FK → commission_protocols.id, nullable)

**Решение:** Обновить schema-spec.md.

### 2. Расхождения моделей с ERD

#### 2.1. Отсутствуют 7 таблиц
`incentive_programs`, `commission_protocols`, `payout_rows`, `event_plans`, `plan_items`, `coach_vacations`, `coach_sick_leaves`

#### 2.2. Отсутствуют столбцы в существующих таблицах
- `centers`: `city`, `center_type`
- `athletes`: `enrollment_type`
- `reports`: `program_id`, `payout_tier`, `commission_protocol_id`

#### 2.3. Неверные типы данных в ERD
- `audit_logs.old_value/new_value`: ERD = `text`, модель = `JSONB`
- `schedules.day_of_week`: ERD = `string`, модель = `Integer`
- `centers.address`: ERD = `string(200)`, модель = `Text`

#### 2.4. Отсутствуют 14 связей
Все FK-связи для новых таблиц + `reviewer_id` в `reports`.

#### 2.5.vk_users / vk_notifications
Есть в ERD, моделей нет. Решение: пометить как Planned.

### 3. Сводная таблица действий

| # | Действие | Приоритет | Тип |
|---|----------|-----------|-----|
| 1 | Добавить UNIQUE constraints (attendance, participants, results) | P0 | Миграция |
| 2 | Добавить ON DELETE к 5 FK | P0 | Миграция |
| 3 | Добавить CHECK constraints (schedules, events) | P1 | Миграция |
| 4 | Исправить `payout_tier` → `mapped_column(Integer, nullable=True)` | P1 | Модель |
| 5 | Добавить `CoachSickLeave` + `CoachVacation` в `__all__` | P2 | Модель |
| 6 | Обновить schema-spec.md (7 новых таблиц, расширения, updated_at) | P1 | Документация |
| 7 | Обновить ERD.md (Mermaid + описание) | P2 | Документация |

## Alternatives Considered

1. **PostgreSQL ENUM вместо String** — rejected. Миграции с ALTER TYPE сложны, а список значений и так контролируется приложением.

2. **Убрать `updated_at` из «лишних» таблиц** — rejected. Стоимость хранения минимальна, а lợiсть аудита значительна.

3. **Переименовать `created_at` → `registered_at` в participants** — rejected. Семантика идентична, переименование потребует миграцию + обновление всего кода.

## Consequences

### Готово
- ☑ ADR-020 создан (2026-07-15)
- ☑ Тройной аудит завершён: 37 таблиц, 3 проверки
- ☑ Модели и миграции синхронизированы (0 расхождений)

### Запланировано
- ☐ Новая миграция: UNIQUE + ON DELETE + CHECK constraints
- ☐ Исправление типа `payout_tier` в модели Report
- ☐ Обновление schema-spec.md
- ☐ Обновление ERD.md
- ☐ Добавление `CoachSickLeave` + `CoachVacation` в `__all__`
- ☐ Обновление roadmap.md
