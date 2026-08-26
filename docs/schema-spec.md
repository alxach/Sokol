# Спецификация схемы БД «СОКОЛ»

> Версия 1.0 | PostgreSQL + SQLAlchemy | Дата: 2026-05-29

---

## Содержание

1. [Соглашения](#1-соглашения)
2. [Enum и домены](#2-enum-и-домены)
3. [Таблицы — полная спецификация](#3-таблицы)
4. [Правила внешних ключей](#4-правила-внешних-ключей)
5. [Индексы](#5-индексы)
6. [Триггеры и default-значения](#6-триггеры)
7. [Миграционная стратегия](#7-миграционная-стратегия)

---

## 1. Соглашения

### 1.1 Naming

| Объект | Правило | Пример |
|--------|---------|--------|
| Таблицы | `snake_case`, множественное число | `athletes`, `coach_categories` |
| Поля | `snake_case` | `first_name`, `center_id` |
| PK | всегда `id` | `id UUID PK` |
| FK | `{singular_table}_id` | `athlete_id`, `coach_id` |
| Индексы | `ix_{table}_{column}` | `ix_athletes_center_id` |
| Unique | `uq_{table}_{column}` | `uq_users_email` |
| Enum | `PascalCase` | `AttendanceStatus`, `ReportStatus` |

### 1.2 Типы данных

| Тип PostgreSQL | SQLAlchemy | Применение |
|---------------|------------|------------|
| `UUID` | `UUID(as_uuid=True)` | Все PK |
| `VARCHAR(n)` | `String(n)` | Короткие строки (ФИО, названия) |
| `TEXT` | `Text` | Длинные строки, JSON |
| `TIMESTAMP WITH TIME ZONE` | `DateTime(timezone=True)` | created_at, updated_at |
| `DATE` | `Date` | birth_date, start_date |
| `TIME` | `Time` | start_time, end_time |
| `BOOLEAN` | `Boolean` | is_active, is_verified |
| `INTEGER` | `Integer` | vk_user_id, max_capacity |
| `JSONB` | `JSONB` | data_json, structure_json |

### 1.3 Общие поля (миксин)

```python
class TimestampMixin:
    id: UUID       # PK, default=uuid4
    created_at: datetime  # default=now(), не null
    updated_at: datetime  # onupdate=now(), не null
    deleted_at: datetime  # soft-delete, nullable
```

### 1.4 Правила для всех таблиц

- `id` — UUID v4, `PRIMARY KEY`, `DEFAULT gen_random_uuid()`
- `created_at` — `NOT NULL`, `DEFAULT NOW()`
- `updated_at` — `NOT NULL`, `DEFAULT NOW()`, обновляется на каждый UPDATE
- `deleted_at` — `NULLABLE`, soft-delete (кроме таблиц-связок)
- Все FK — `UUID`, `NOT NULL` если связь обязательна

---

## 2. Enum и домены

### 2.1 UserRole (роли)

| Роль | Описание | Кому назначается |
|------|----------|------------------|
| `superadmin` | Полный доступ ко всей системе | Разработчик, владелец системы |
| `director` | Руководитель всех центров | Генеральный директор ЦСЕ |
| `admin` | Администратор своего центра | Руководитель филиала, завуч |
| `coach` | Тренер | Тренерский состав |
| `methodist` | Методист: шаблоны отчётов, аналитика качества, методички | Методист организации |

| `viewer` | Только чтение | Гость, инспекция, вышестоящая организация |

---

#### superadmin

```
Охват:          Вся система, все центры, все данные
Ограничения:    Нет
```

| Модуль | Доступ |
|--------|--------|
| Регионы / Федераций / Центры | Полный CRUD |
| Пользователи / Роли / Права | Полный CRUD, назначение ролей |
| Спортсмены (любые) | Полный CRUD |
| Тренеры (любые) | Полный CRUD |
| Группы / Расписание (любые) | Полный CRUD |
| Посещаемость | Полный CRUD |
| Отчёты | Полный CRUD, утверждение |
| Мероприятия / Турниры | Полный CRUD |
| Документы | Полный CRUD, согласование |
| Аудит | Полный просмотр |
| Управление ролями | ✅ Создание/удаление ролей, назначение любому |

---

#### director

```
Охват:          Все центры, все тренеры, все спортсмены
Ограничения:    Не управляет ролями и правами
```

| Модуль | Доступ |
|--------|--------|
| Регионы / Федераций / Центры | Просмотр всех, редактирование своего ЦСЕ |
| Пользователи | Просмотр всех |
| Роли / Права | ❌ Не управляет |
| Спортсмены (все центры) | Полный CRUD (в т.ч. удаление) |
| Тренеры (все центры) | Полный CRUD (найм/увольнение), передача между центрами |
| Группы / Расписание (все) | Полный CRUD, передача тренеру |
| Посещаемость | Просмотр по всем центрам |
| Отчёты | Просмотр всех, утверждение |
| Мероприятия / Турниры | Полный CRUD по всем центрам |
| Документы | Просмотр всех, согласование |
| Аудит | Просмотр по всем центрам |

**Ключевое отличие от admin:** видит и управляет всеми центрами сразу.

---

#### admin

```
Охват:          Свой центр (center_id)
Ограничения:    Не выходит за пределы своего центра
```

| Модуль | Доступ |
|--------|--------|
| Центр | Редактирование своего центра |
| Пользователи | CRUD в своём центре (создание учёток для тренеров) |
| Роли / Права | ❌ Не управляет |
| Спортсмены (своего центра) | Полный CRUD (включая удаление) |
| Тренеры (своего центра) | Полный CRUD (найм/увольнение) |
| Группы (своего центра) | Полный CRUD, передача тренеру |
| Расписание (своего центра) | Полный CRUD |
| Посещаемость | Просмотр по своему центру |
| Отчёты | Просмотр всех отчётов центра, проверка, утверждение |
| Мероприятия (своего центра) | Полный CRUD |
| Документы | Просмотр, согласование |
| Аудит | Просмотр действий в своём центре |

**Ключевое отличие от director:** видит и управляет только своим центром.

---

#### coach

```
Охват:          Только свои группы и свои данные
Ограничения:    Не видит чужих групп и спортсменов
```

| Модуль | Доступ |
|--------|--------|
| Свой профиль | Редактирование (фото, телефон, биография) |
| Другие тренеры | ❌ Не видит |
| Спортсмены (свои) | CRUD (создаёт, редактирует, архивирует, НО не удаляет) |
| Спортсмены (чужие) | ❌ Не видит |
| Группы (свои) | Создаёт, редактирует, НО не удаляет |
| Группы (чужие) | ❌ Не видит |
| Расписание (своих групп) | Полный CRUD |
| Посещаемость (своих занятий) | Отметка, журнал, просмотр статистики |
| Отчёты | Создаёт/редактирует только свои черновики и отправленные |
| Мероприятия | Просмотр, регистрация спортсменов |
| Документы | ❌ Только по роли «тренер» — создание заявок |
| Другие центры | ❌ |
| Аудит | ❌ |
| Категории (свои) | Просмотр |

---

#### methodist

```
Охват:          Весь центр (center_id)
Ограничения:    Не управляет тренерами и спортсменами
```

| Модуль | Доступ |
|--------|--------|
| Шаблоны отчётов | Полный CRUD (создание, редактирование, деактивация) |
| Шаблоны документов | Полный CRUD |
| Отчёты (все центра) | Просмотр, аналитика качества |
| Документы (все центра) | Просмотр |
| Дашборды | Просмотр |
| Спортсмены | Только просмотр |
| Тренеры | Только просмотр |
| Группы / Расписание | Только просмотр |
| Посещаемость | Просмотр статистики |
| Мероприятия | Просмотр |
| Управление пользователями | ❌ |
| Роли / Права | ❌ |
| Утверждение отчётов | ❌ |
| Аудит | ❌ |

---

#### viewer

```
Охват:          Вся система, только чтение
Ограничения:    Ничего не создаёт, не редактирует, не удаляет
```

| Модуль | Доступ |
|--------|--------|
| Дашборды | Просмотр |
| Спортсмены | Просмотр |
| Тренеры | Просмотр |
| Группы / Расписание | Просмотр |
| Посещаемость | Просмотр статистики |
| Отчёты | Просмотр утверждённых |
| Мероприятия | Просмотр |
| Любое создание/изменение | ❌ |

---

#### Сводная матрица доступа

| Действие | superadmin | director | admin | coach | methodist | viewer |
|----------|:----------:|:--------:|:-----:|:-----:|:---------:|:------:|
| Управление ролями | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Управление пользователями | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| CRUD центров | ✅ | ✅* | ✅ | ❌ | ❌ | ❌ |
| CRUD спортсменов (все) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| CRUD спортсменов (своих) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Просмотр спортсменов | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| CRUD тренеров (все) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| CRUD тренеров (своего центра) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Создание групп | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Удаление групп | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Отметка посещаемости | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Просмотр посещаемости | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CRUD шаблонов отчётов | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| CRUD отчётов (своих) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Утверждение отчётов | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Просмотр отчётов | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BI / Аналитика | ✅ | ✅ | ✅ | ✅* | ✅ | ❌ |

> \* — в рамках своего центра

### 2.2 AttendanceStatus (статус посещаемости)

| Значение | Описание |
|----------|----------|
| `present` | Присутствовал |
| `absent` | Отсутствовал |
| `late` | Опоздал |
| `excused` | Отсутствовал по уважительной причине |
| `sick` | Болеет |

### 2.3 ReportStatus (статус отчёта)

| Значение | Описание |
|----------|----------|
| `draft` | Черновик (только автор видит) |
| `submitted` | Отправлен на проверку |
| `reviewed` | Проверен руководителем |
| `approved` | Утверждён |
| `rejected` | Отклонён (с комментарием) |

### 2.4 DocumentStatus (статус документа)

| Значение | Описание |
|----------|----------|
| `draft` | Черновик |
| `pending_approval` | На согласовании |
| `approved` | Согласован |
| `rejected` | Отклонён |

### 2.5 EventType (тип мероприятия)

| Значение | Описание |
|----------|----------|
| `tournament` | Соревнование / турнир |
| `master_class` | Мастер-класс |
| `training_camp` | Учебно-тренировочные сборы |
| `trip` | Выезд |
| `meeting` | Собрание / планёрка |

### 2.6 EventStatus (статус мероприятия)

| Значение | Описание |
|----------|----------|
| `planned` | Запланировано |
| `in_progress` | Идёт сейчас |
| `completed` | Завершено |
| `cancelled` | Отменено |

### 2.7 CompetitionType (тип соревнования)

| Значение | Описание |
|----------|----------|
| `municipal` | Муниципальное |
| `regional` | Региональное |
| `federal` | Федеральное |
| `international` | Международное |

### 2.8 ParticipantStatus (статус участника)

| Значение | Описание |
|----------|----------|
| `registered` | Зарегистрирован |
| `confirmed` | Подтверждён |
| `competed` | Выступил |
| `withdrawn` | Снят |

### 2.9 AthleteStatus (статус спортсмена)

| Значение | Описание |
|----------|----------|
| `active` | Активно тренируется |
| `inactive` | Не тренируется временно |
| `graduated` | Выпустился |
| `transferred` | Переведён в другой центр |
| `expelled` | Отчислен |

### 2.10 EnrollmentType (тип зачисления)

| Значение | Описание |
|----------|----------|
| `enrolled` | Официально зачислен в школу |
| `paid` | Платная основа |
| `free` | Бесплатная основа |

### 2.11 CheckInMethod (способ отметки)

| Значение | Описание |
|----------|----------|
| `manual` | Вручную тренером |
| `qr` | По QR-коду |
| `vk` | Через VK Mini App |

### 2.12 DocType (типы документов)

| Значение | Описание |
|----------|----------|
| `birth_certificate` | Свидетельство о рождении |
| `passport` | Паспорт |
| `medical_certificate` | Медицинская справка |
| `insurance` | Страховка |
| `parental_consent` | Согласие родителей |
| `sports_insurance` | Спортивная страховка |

### 2.13 ApprovalAction (действие согласования)

| Значение | Описание |
|----------|----------|
| `approved` | Согласовано |
| `rejected` | Отклонено |
| `returned_for_revision` | Возвращено на доработку |

---

## 3. Таблицы

### 3.1 `users` — Пользователи системы

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | | Email для входа |
| `phone` | VARCHAR(20) | UNIQUE, NOT NULL | | Телефон |
| `password_hash` | VARCHAR(255) | NOT NULL | | Хеш пароля (bcrypt) |
| `first_name` | VARCHAR(100) | NOT NULL | | Имя |
| `last_name` | VARCHAR(100) | NOT NULL | | Фамилия |
| `middle_name` | VARCHAR(100) | NULLABLE | | Отчество |
| `avatar_url` | VARCHAR(500) | NULLABLE | | Ссылка на фото |
| `is_active` | BOOLEAN | NOT NULL | `true` | Блокировка входа |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | | Soft-delete |

**Связи:**  
- 1 → many `user_roles`
- 1 → one `coaches`

- 1 → many `reports`
- 1 → many `documents`
- 1 → many `audit_logs`
- 1 → many `vk_users`
- 1 → many `vk_notifications`

---

### 3.2 `roles` — Роли

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | | Код роли (`admin`, `coach`, ...) |
| `name` | VARCHAR(100) | NOT NULL | | Человеческое название |
| `description` | TEXT | NULLABLE | | |
| `is_system` | BOOLEAN | NOT NULL | `false` | Системную нельзя удалить |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.3 `permissions` — Права

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `code` | VARCHAR(100) | UNIQUE, NOT NULL | | `athletes.create`, `reports.approve` |
| `name` | VARCHAR(100) | NOT NULL | | |
| `resource` | VARCHAR(50) | NOT NULL | | `athletes`, `reports`, `groups` |
| `action` | VARCHAR(50) | NOT NULL | | `create`, `read`, `update`, `delete`, `approve` |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.4 `role_permissions` — Связка ролей и прав

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `role_id` | UUID | PK, FK → roles.id ON DELETE CASCADE |
| `permission_id` | UUID | PK, FK → permissions.id ON DELETE CASCADE |

---

### 3.5 `user_roles` — Связка пользователей и ролей

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `user_id` | UUID | PK, FK → users.id ON DELETE CASCADE |
| `role_id` | UUID | PK, FK → roles.id ON DELETE RESTRICT |

---

### 3.6 `regions` — Регионы

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `name` | VARCHAR(200) | NOT NULL | | Название региона |
| `code` | VARCHAR(10) | UNIQUE, NOT NULL | | Код региона (24, 77...) |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.7 `centers` — Центры / филиалы / клубы

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `name` | VARCHAR(200) | NOT NULL | | Название (ЦСЕ Ачинск) |
| `region_id` | UUID | FK → regions.id | | |
| `address` | TEXT | NULLABLE | | |
| `city` | VARCHAR(100) | NULLABLE | | Город (добавлен ADR-020) |
| `center_type` | VARCHAR(50) | NOT NULL | `'cse'` | Тип центра (добавлен ADR-020) |
| `phone` | VARCHAR(20) | NULLABLE | | |
| `email` | VARCHAR(255) | NULLABLE | | |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Связи:**  
- 1 → many `athletes`
- 1 → many `coaches`
- 1 → many `groups`
- 1 → many `events`
- 1 → many `reports`
- 1 → many `commission_protocols`
- 1 → many `event_plans`

---

### 3.10 `athletes` — Спортсмены

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `first_name` | VARCHAR(100) | NOT NULL | | |
| `last_name` | VARCHAR(100) | NOT NULL | | |
| `middle_name` | VARCHAR(100) | NULLABLE | | |
| `birth_date` | DATE | NOT NULL | | DD.MM.YYYY |
| `gender` | VARCHAR(10) | NOT NULL | | `male` / `female` |
| `photo_url` | VARCHAR(500) | NULLABLE | | |
| `center_id` | UUID | FK → centers.id | | |
| `coach_id` | UUID | FK → coaches.id | | Основной тренер |
| `sport_type` | VARCHAR(100) | NOT NULL | | Вид спорта |
| `rank` | VARCHAR(50) | NULLABLE | | Разряд/звание |
| `rank_assign_date` | DATE | NULLABLE | | Дата присвоения |
| `rank_order_number` | VARCHAR(50) | NULLABLE | | Номер приказа |
| `status` | AthleteStatus | NOT NULL | `active` | |
| `enrollment_type` | EnrollmentType | NOT NULL | `enrolled` | Тип зачисления |
| `notes` | TEXT | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.11 `athlete_documents` — Документы спортсмена

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `athlete_id` | UUID | FK → athletes.id | | |
| `doc_type` | DocType | NOT NULL | | Тип документа |
| `doc_number` | VARCHAR(100) | NULLABLE | | Номер документа |
| `issue_date` | DATE | NULLABLE | | Дата выдачи |
| `expire_date` | DATE | NULLABLE | | Срок действия |
| `file_url` | VARCHAR(500) | NULLABLE | | Скан/фото |
| `is_verified` | BOOLEAN | NOT NULL | `false` | Подтверждён админом |
| `verified_by` | UUID | FK → users.id, NULLABLE | | Кто подтвердил |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.12 `athlete_medical` — Медицинские осмотры

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `athlete_id` | UUID | FK → athletes.id | | |
| `medical_type` | VARCHAR(100) | NOT NULL | | Первичный, ежегодный, углублённый |
| `examination_date` | DATE | NOT NULL | | Дата осмотра |
| `valid_until` | DATE | NOT NULL | | Действителен до |
| `diagnosis` | TEXT | NULLABLE | | |
| `doctor_name` | VARCHAR(200) | NULLABLE | | |
| `file_url` | VARCHAR(500) | NULLABLE | | |
| `is_approved` | BOOLEAN | NOT NULL | `false` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.13 `athlete_ranks_history` — История разрядов

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `athlete_id` | UUID | FK → athletes.id | | |
| `rank_before` | VARCHAR(50) | NULLABLE | | Какой разряд был |
| `rank_after` | VARCHAR(50) | NOT NULL | | Какой присвоен |
| `assign_date` | DATE | NOT NULL | | Дата приказа |
| `order_number` | VARCHAR(50) | NULLABLE | | Номер приказа |
| `file_url` | VARCHAR(500) | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.14 `athlete_achievements` — Достижения

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `athlete_id` | UUID | FK → athletes.id | | |
| `competition_id` | UUID | FK → competitions.id, NULLABLE | | |
| `achievement_type` | VARCHAR(50) | NOT NULL | | `medal`, `rank`, `title` |
| `place` | VARCHAR(50) | NULLABLE | | `1`, `2`, `3`, `участие` |
| `medal` | VARCHAR(20) | NULLABLE | | `gold`, `silver`, `bronze` |
| `date` | DATE | NOT NULL | | |
| `description` | TEXT | NULLABLE | | |
| `file_url` | VARCHAR(500) | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.15 `coaches` — Тренеры

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `user_id` | UUID | FK → users.id, UNIQUE | | Привязка к учётке |
| `center_id` | UUID | FK → centers.id | | К какому центру приписан |
| `specialization` | VARCHAR(200) | NOT NULL | | Специализация |
| `qualification` | VARCHAR(100) | NULLABLE | | Категория / квалификация |
| `biography` | TEXT | NULLABLE | | Биография |
| `hire_date` | DATE | NOT NULL | | Дата найма |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Связи:**  
- 1 → many `groups`
- 1 → many `athletes` (by `coach_id`)
- 1 → many `schedules`
- 1 → many `coach_categories`
- 1 → many `reports`

---

### 3.16 `coach_categories` — Категории тренера

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `coach_id` | UUID | FK → coaches.id | | |
| `category_name` | VARCHAR(100) | NOT NULL | | «Высшая», «Первая» |
| `certified_at` | DATE | NOT NULL | | Дата присвоения |
| `valid_until` | DATE | NULLABLE | | Срок действия |
| `document_url` | VARCHAR(500) | NULLABLE | | Скан удостоверения |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.17 `groups` — Тренировочные группы

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `name` | VARCHAR(200) | NOT NULL | | «Группа начальной подготовки 1» |
| `center_id` | UUID | FK → centers.id | | |
| `coach_id` | UUID | FK → coaches.id | | Руководитель группы |
| `sport_type` | VARCHAR(100) | NOT NULL | | |
| `age_group` | VARCHAR(50) | NULLABLE | | «7-9», «10-12» |
| `skill_level` | VARCHAR(50) | NULLABLE | | «начальный», «средний», «высший» |
| `max_capacity` | INTEGER | NOT NULL | `30` | |
| `schedule_note` | TEXT | NULLABLE | | Текстовое описание расписания |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.18 `group_members` — Состав групп

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `group_id` | UUID | PK, FK → groups.id ON DELETE CASCADE | | |
| `athlete_id` | UUID | PK, FK → athletes.id ON DELETE CASCADE | | |
| `join_date` | DATE | NOT NULL | | |
| `leave_date` | DATE | NULLABLE | | |
| `is_active` | BOOLEAN | NOT NULL | `true` | |

---

### 3.19 `schedules` — Расписание

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `group_id` | UUID | FK → groups.id | | |
| `center_id` | UUID | FK → centers.id | | |
| `coach_id` | UUID | FK → coaches.id | | |
| `day_of_week` | INTEGER | NOT NULL, CHECK(1-7) | | 1=пн ... 7=вс |
| `start_time` | TIME | NOT NULL | | |
| `end_time` | TIME | NOT NULL | | |
| `location` | VARCHAR(200) | NULLABLE | | «Зал борьбы» |
| `room` | VARCHAR(50) | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Constraint:** `CHECK (start_time < end_time)`

---

### 3.20 `attendance` — Посещаемость

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `athlete_id` | UUID | FK → athletes.id | | |
| `schedule_id` | UUID | FK → schedules.id | | |
| `group_id` | UUID | FK → groups.id | | |
| `date` | DATE | NOT NULL | | |
| `status` | AttendanceStatus | NOT NULL | | |
| `check_in_time` | TIME | NULLABLE | | |
| `absence_reason` | TEXT | NULLABLE | | |
| `check_in_method` | CheckInMethod | NULLABLE | | |
| `checked_by` | UUID | FK → users.id, NULLABLE | | Кто отметил |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Unique:** `(athlete_id, schedule_id, date)` — одна отметка на занятие

---

### 3.21 `attendance_qr_codes` — QR-коды

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `schedule_id` | UUID | FK → schedules.id | | |
| `qr_code` | VARCHAR(255) | UNIQUE, NOT NULL | | Уникальный код |
| `valid_date` | DATE | NOT NULL | | На какую дату |
| `valid_from` | TIME | NOT NULL | | |
| `valid_until` | TIME | NOT NULL | | |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.22 `events` — Мероприятия

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `name` | VARCHAR(300) | NOT NULL | | |
| `event_type` | EventType | NOT NULL | | |
| `center_id` | UUID | FK → centers.id | | Организатор |
| `organizer_id` | UUID | FK → users.id, NULLABLE | | Ответственный |
| `start_date` | DATE | NOT NULL | | |
| `end_date` | DATE | NOT NULL | | |
| `location` | VARCHAR(300) | NOT NULL | | Город / место |
| `description` | TEXT | NULLABLE | | |
| `status` | EventStatus | NOT NULL | `planned` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Constraint:** `CHECK (start_date <= end_date)`

---

### 3.23 `competitions` — Соревнования

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `event_id` | UUID | FK → events.id | | |
| `name` | VARCHAR(300) | NOT NULL | | «Греко-римская борьба до 45 кг» |
| `discipline` | VARCHAR(100) | NOT NULL | | |
| `age_group` | VARCHAR(50) | NULLABLE | | |
| `gender` | VARCHAR(10) | NULLABLE | | `male`, `female`, `mixed` |
| `weight_category` | VARCHAR(50) | NULLABLE | | |
| `competition_type` | CompetitionType | NOT NULL | | |
| `max_participants` | INTEGER | NULLABLE | | |
| `status` | VARCHAR(50) | NOT NULL | `planned` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.24 `participants` — Участники соревнований

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `competition_id` | UUID | FK → competitions.id | | |
| `athlete_id` | UUID | FK → athletes.id | | |
| `status` | ParticipantStatus | NOT NULL | `registered` | |
| `seed` | INTEGER | NULLABLE | | Номер посева |
| `weight_at_registration` | VARCHAR(20) | NULLABLE | | Вес на взвешивании |
| `registered_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Unique:** `(competition_id, athlete_id)`

---

### 3.25 `results` — Результаты выступлений

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `competition_id` | UUID | FK → competitions.id | | |
| `athlete_id` | UUID | FK → athletes.id | | |
| `participant_id` | UUID | FK → participants.id, NULLABLE | | |
| `stage` | VARCHAR(50) | NULLABLE | | «финал», «полуфинал» |
| `position` | INTEGER | NULLABLE | | Итоговое место |
| `score` | VARCHAR(50) | NULLABLE | | «10:5» |
| `result_value` | VARCHAR(50) | NULLABLE | | Победа / поражение |
| `medal` | VARCHAR(20) | NULLABLE | | `gold`, `silver`, `bronze` |
| `notes` | TEXT | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Unique:** `(competition_id, athlete_id, stage)`

---

### 3.27 `report_templates` — Шаблоны отчётов

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `name` | VARCHAR(200) | NOT NULL | | |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | | `weekly_coach_report` |
| `report_type` | VARCHAR(50) | NOT NULL | | `weekly`, `monthly`, `quarterly` |
| `structure_json` | JSONB | NOT NULL | | Структура полей отчёта |
| `description` | TEXT | NULLABLE | | |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.28 `reports` — Отчёты

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `template_id` | UUID | FK → report_templates.id | | |
| `author_id` | UUID | FK → users.id | | Кто создал |
| `center_id` | UUID | FK → centers.id | | |
| `coach_id` | UUID | FK → coaches.id, NULLABLE | | |
| `program_id` | UUID | FK → incentive_programs.id, NULLABLE | | Программа стимулирования (ADR-019) |
| `payout_tier` | INTEGER | NULLABLE | | Уровень выплаты: 50000 / 25000 / 0 (ADR-019) |
| `commission_protocol_id` | UUID | FK → commission_protocols.id, NULLABLE | | Протокол комиссии (ADR-019) |
| `period_type` | VARCHAR(20) | NOT NULL | | `weekly`, `monthly` |
| `period_start` | DATE | NOT NULL | | |
| `period_end` | DATE | NOT NULL | | |
| `data_json` | JSONB | NOT NULL | | Данные отчёта |
| `status` | ReportStatus | NOT NULL | `draft` | |
| `reviewer_id` | UUID | FK → users.id, NULLABLE | | Кто проверяет |
| `review_comment` | TEXT | NULLABLE | | |
| `reviewed_at` | TIMESTAMPTZ | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.29 `report_submissions` — История статусов отчёта

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `report_id` | UUID | FK → reports.id | | |
| `submitted_by` | UUID | FK → users.id | | |
| `status` | ReportStatus | NOT NULL | | |
| `comment` | TEXT | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.30 `document_templates` — Шаблоны документов

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `name` | VARCHAR(200) | NOT NULL | | |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | | |
| `doc_type` | VARCHAR(50) | NOT NULL | | `order`, `application` |
| `template_fields_json` | JSONB | NOT NULL | | Поля для заполнения |
| `is_active` | BOOLEAN | NOT NULL | `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.31 `documents` — Сгенерированные документы

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `template_id` | UUID | FK → document_templates.id | | |
| `author_id` | UUID | FK → users.id | | |
| `content_json` | JSONB | NOT NULL | | Заполненные поля |
| `status` | DocumentStatus | NOT NULL | `draft` | |
| `file_url` | VARCHAR(500) | NULLABLE | | Сгенерированный PDF |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.32 `document_approvals` — Согласование документов

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `document_id` | UUID | FK → documents.id | | |
| `approver_id` | UUID | FK → users.id | | |
| `action` | ApprovalAction | NOT NULL | | |
| `comment` | TEXT | NULLABLE | | |
| `step_order` | INTEGER | NOT NULL | | Порядок согласования |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.33 `vk_users` — Привязка VK ID

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `user_id` | UUID | FK → users.id | | |
| `vk_user_id` | INTEGER | UNIQUE, NOT NULL | | ID пользователя VK |
| `vk_access_token` | VARCHAR(500) | NULLABLE | | Токен для VK API |
| `platform` | VARCHAR(50) | NULLABLE | | `vk`, `vk_test` |
| `is_verified` | BOOLEAN | NOT NULL | `false` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.34 `vk_notifications` — Уведомления через VK

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `user_id` | UUID | FK → users.id | | |
| `notification_type` | VARCHAR(50) | NOT NULL | | `report_reminder`, `event` |
| `title` | VARCHAR(200) | NOT NULL | | |
| `message` | TEXT | NOT NULL | | |
| `is_read` | BOOLEAN | NOT NULL | `false` | |
| `is_sent` | BOOLEAN | NOT NULL | `false` | |
| `sent_at` | TIMESTAMPTZ | NULLABLE | | |
| `read_at` | TIMESTAMPTZ | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.35 `audit_logs` — Аудит действий

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `user_id` | UUID | FK → users.id | | |
| `action` | VARCHAR(50) | NOT NULL | | `create`, `update`, `delete` |
| `resource` | VARCHAR(50) | NOT NULL | | `athletes`, `reports` |
| `resource_id` | VARCHAR(50) | NULLABLE | | ID объекта |
| `old_value` | JSONB | NULLABLE | | |
| `new_value` | JSONB | NULLABLE | | |
| `ip_address` | VARCHAR(45) | NULLABLE | | |
| `user_agent` | TEXT | NULLABLE | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.36 `coach_vacations` — Отпуска тренеров (ADR-001)

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `coach_id` | UUID | FK → coaches.id | | |
| `start_date` | DATE | NOT NULL | | Дата начала отпуска |
| `end_date` | DATE | NOT NULL | | Дата окончания отпуска |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.37 `coach_sick_leaves` — Больничные тренеров (ADR-002)

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `coach_id` | UUID | FK → coaches.id | | |
| `start_date` | DATE | NOT NULL | | Дата начала больничного |
| `end_date` | DATE | NOT NULL | | Дата окончания больничного |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.38 `incentive_programs` — Программы материального стимулирования (ADR-019)

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `name` | VARCHAR(200) | NOT NULL | | Наименование программы |
| `regulation_number` | VARCHAR(50) | UNIQUE, NOT NULL | | Номер приказа (ЦСиЗ-26-П022) |
| `regulation_date` | DATE | NOT NULL | | Дата приказа |
| `revision` | INTEGER | NOT NULL | | Номер редакции |
| `max_payout` | INTEGER | NOT NULL | `50000` | Максимальная выплата (нетто) |
| `min_payout` | INTEGER | NOT NULL | `25000` | Минимальная выплата (нетто) |
| `ndfl_rate` | NUMERIC(5,2) | NOT NULL | `13.00` | Ставка НДФЛ (%) |
| `insurance_rate` | NUMERIC(5,2) | NOT NULL | `30.20` | Ставка страховых взносов (%) |
| `is_discretionary` | BOOLEAN | NOT NULL | `true` | Факультативность (п. 1.3 ред. 8) |
| `status` | VARCHAR(20) | NOT NULL | `'active'` | `active` / `archived` |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

---

### 3.39 `commission_protocols` — Протоколы комиссии (ADR-019, Приложение №6)

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `number` | VARCHAR(50) | NOT NULL | | Номер протокола |
| `date` | DATE | NOT NULL | | Дата заседания |
| `beneficiary_name` | VARCHAR(500) | NOT NULL | | Наименование учреждения-благополучателя |
| `period` | VARCHAR(50) | NOT NULL | | Отчётный период |
| `center_id` | UUID | FK → centers.id | | Центр |
| `agenda` | TEXT | NULLABLE | | Повестка дня |
| `decisions` | TEXT | NULLABLE | | Решения |
| `voting_for` | INTEGER | NOT NULL | `0` | Голосов «за» |
| `voting_against` | INTEGER | NOT NULL | `0` | Голосов «против» |
| `voting_abstained` | INTEGER | NOT NULL | `0` | Воздержались |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Связи:**
- 1 → many `payout_rows`
- many → 1 `centers`

---

### 3.40 `payout_rows` — Строки выплат (ADR-019, Приложение №6)

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `protocol_id` | UUID | FK → commission_protocols.id ON DELETE CASCADE | | Протокол |
| `coach_id` | UUID | FK → coaches.id | | Тренер |
| `report_id` | UUID | FK → reports.id, NULLABLE | | Связанный отчёт |
| `sport_type` | VARCHAR(100) | NOT NULL | | Вид спорта |
| `period_start` | DATE | NOT NULL | | Начало периода |
| `period_end` | DATE | NOT NULL | | Конец периода |
| `gross_amount` | NUMERIC(12,2) | NOT NULL | | Сумма брутто |
| `ndfl_amount` | NUMERIC(12,2) | NOT NULL | | НДФЛ |
| `insurance_amount` | NUMERIC(12,2) | NOT NULL | | Страховые взносы |
| `net_amount` | NUMERIC(12,2) | NOT NULL | | Сумма нетто (на карту) |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Связи:**
- many → 1 `commission_protocols`
- many → 1 `coaches`
- many → 1 `reports`

---

### 3.41 `event_plans` — Планы мероприятий тренеров (ADR-019, Приложение №7)

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `coach_id` | UUID | FK → coaches.id | | Тренер |
| `center_id` | UUID | FK → centers.id | | Центр |
| `program_id` | UUID | FK → incentive_programs.id, NULLABLE | | Программа |
| `year` | INTEGER | NOT NULL | | Год плана |
| `status` | VARCHAR(20) | NOT NULL | `'draft'` | `draft` / `submitted` / `approved` / `rejected` |
| `reviewer_id` | UUID | FK → users.id, NULLABLE | | Кто проверил |
| `review_comment` | TEXT | NULLABLE | | Комментарий проверяющего |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Связи:**
- 1 → many `plan_items`
- many → 1 `coaches`
- many → 1 `centers`
- many → 1 `incentive_programs`

---

### 3.42 `plan_items` — Элементы плана мероприятий (ADR-019)

| Поле | Тип | Ограничения | Default | Описание |
|------|-----|-------------|---------|----------|
| `id` | UUID | PK | gen_random_uuid() | |
| `plan_id` | UUID | FK → event_plans.id ON DELETE CASCADE | | План |
| `category` | VARCHAR(5) | NOT NULL | | Категория: `3`, `4`, `5` |
| `quarter` | INTEGER | NOT NULL | | Квартал (1-4) |
| `month` | INTEGER | NOT NULL | | Месяц (1-12) |
| `date` | VARCHAR(20) | NOT NULL | | Дата (строка из Excel) |
| `name` | VARCHAR(500) | NOT NULL | | Наименование мероприятия |
| `description` | TEXT | NULLABLE | | Формат/содержание/цель |
| `location` | VARCHAR(500) | NULLABLE | | Место проведения |
| `participants_category` | VARCHAR(500) | NULLABLE | | Категория участников |
| `participants_count` | VARCHAR(100) | NULLABLE | | Кол-во участников |
| `status` | VARCHAR(20) | NOT NULL | `'draft'` | Статус элемента |
| `reviewer_comment` | TEXT | NULLABLE | | Комментарий |
| `created_at` | TIMESTAMPTZ | NOT NULL | now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | |

**Связи:**
- many → 1 `event_plans`

---

## 4. Правила внешних ключей

### 4.1 ON DELETE — стратегия

| Parent | Child | Правило | Обоснование |
|--------|-------|---------|-------------|
| `users` | `user_roles` | CASCADE | Роли удаляются вместе с пользователем |
| `users` | `coaches` | RESTRICT | Нельзя удалить пользователя-тренера — сначала расформировать |
| `users` | `reports` | RESTRICT | Отчёты должны быть перепривязаны |
| `roles` | `user_roles` | RESTRICT | Нельзя удалить роль, если есть пользователи |
| `roles` | `role_permissions` | CASCADE | Права роли удаляются вместе с ролью |
| `centers` | `athletes` | RESTRICT | Есть спортсмены — центр не удалить |
| `centers` | `coaches` | RESTRICT | Есть тренеры — центр не удалить |
| `centers` | `groups` | RESTRICT | Есть группы — центр не удалить |
| `centers` | `events` | RESTRICT | |
| `coaches` | `groups` | SET NULL | Группы остаются, тренер становится NULL |
| `coaches` | `athletes` | SET NULL | Спортсмены остаются, тренер NULL |
| `groups` | `group_members` | CASCADE | Состав удаляется вместе с группой |
| `groups` | `schedules` | CASCADE | Расписание удаляется вместе с группой |
| `groups` | `attendance` | CASCADE | Посещаемость удаляется вместе с группой |
| `athletes` | `athlete_documents` | CASCADE | Документы удаляются со спортсменом |
| `athletes` | `athlete_medical` | CASCADE | |
| `athletes` | `athlete_ranks_history` | CASCADE | |
| `athletes` | `athlete_achievements` | CASCADE | |
| `events` | `competitions` | CASCADE | |
| `competitions` | `participants` | CASCADE | |
| `competitions` | `results` | CASCADE | |
| `reports` | `report_submissions` | CASCADE | |

### 4.2 ON UPDATE — для всех FK

`CASCADE` — изменение PK автоматически проставляется во всех дочерних записях.

---

## 5. Индексы

| Таблица | Индекс | Тип | Колонки |
|---------|--------|-----|---------|
| `users` | `uq_users_email` | UNIQUE | `(email)` |
| `users` | `uq_users_phone` | UNIQUE | `(phone)` |
| `users` | `ix_users_full_name` | BTREE | `(last_name, first_name, middle_name)` |
| `users` | `ix_users_is_active` | BTREE | `(is_active)` |
| `athletes` | `ix_athletes_center_coach` | BTREE | `(center_id, coach_id)` |
| `athletes` | `ix_athletes_full_name` | BTREE | `(last_name, first_name, birth_date)` |
| `athletes` | `ix_athletes_status` | BTREE | `(status)` |
| `attendance` | `ix_attendance_athlete_date` | BTREE | `(athlete_id, date)` |
| `attendance` | `ix_attendance_schedule_date` | BTREE | `(schedule_id, date)` |
| `attendance` | `uq_attendance_per_class` | UNIQUE | `(athlete_id, schedule_id, date)` |
| `reports` | `ix_reports_author_period` | BTREE | `(author_id, period_start, period_end)` |
| `reports` | `ix_reports_center_status` | BTREE | `(center_id, status)` |
| `schedules` | `ix_schedules_group_day` | BTREE | `(group_id, day_of_week)` |
| `audit_logs` | `ix_audit_user_time` | BTREE | `(user_id, created_at)` |
| `audit_logs` | `ix_audit_resource` | BTREE | `(resource, resource_id)` |
| `groups` | `ix_groups_center_coach` | BTREE | `(center_id, coach_id)` |
| `participants` | `uq_participant_per_competition` | UNIQUE | `(competition_id, athlete_id)` |
| `competitions` | `ix_competitions_event` | BTREE | `(event_id)` |
| `coaches` | `uq_coaches_user_id` | UNIQUE | `(user_id)` |
| `coaches` | `ix_coaches_center` | BTREE | `(center_id)` |
| `vk_users` | `uq_vk_user_id` | UNIQUE | `(vk_user_id)` |
| `results` | `uq_result_per_competition_stage` | UNIQUE | `(competition_id, athlete_id, stage)` |
| `commission_protocols` | `ix_protocols_center` | BTREE | `(center_id)` |
| `event_plans` | `ix_plans_coach_year` | BTREE | `(coach_id, year)` |
| `event_plans` | `ix_plans_center` | BTREE | `(center_id)` |
| `plan_items` | `ix_plan_items_plan` | BTREE | `(plan_id)` |
| `payout_rows` | `ix_payout_rows_protocol` | BTREE | `(protocol_id)` |
| `payout_rows` | `ix_payout_rows_coach` | BTREE | `(coach_id)` |

### 5.1 CHECK-ограничения

| Таблица | Ограничение | Описание |
|---------|-------------|----------|
| `schedules` | `ck_schedules_day_of_week` | `day_of_week BETWEEN 1 AND 7` |
| `schedules` | `ck_schedules_time_range` | `start_time < end_time` |
| `events` | `ck_events_date_range` | `start_date <= end_date` |

---

## 6. Триггеры и default-значения

### 6.1 Автообновление `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяется ко всем таблицам, где есть updated_at
```

### 6.2 Генерация UUID

```python
# SQLAlchemy default
import uuid
from sqlalchemy import Column, UUID, DateTime, func

id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
created_at = Column(DateTime(timezone=True), server_default=func.now())
updated_at = Column(
    DateTime(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
)
```

---

## 7. Миграционная стратегия

| Инструмент | Значение |
|------------|----------|
| **Alembic** | Управление миграциями |
| **Режим** | `--autogenerate` + ручная проверка |
| **Именование** | `{YYYYMMDD_HHMM}_{описание}.py` |
| **Ветки** | Одна линейная ветка (не merge) |

### Правила:

1. Одна миграция == одно логическое изменение
2. `downgrade` обязателен для всех миграций до production
3. Перед применением в production — проверка на staging
4. Никаких прямых `ALTER TABLE` в обход Alembic
5. Seed-данные (роли, permissions, администратор) — в отдельной миграции

### Seed-данные при первом деплое:

```python
# roles: superadmin, director, admin, coach, methodist, viewer
# permissions: CRUD для каждого ресурса
# admin user: root@cse.ru / генерируется при деплое
```
