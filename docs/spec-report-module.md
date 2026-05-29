# Спецификация: Модуль отчетности ЦСЕ (v1)

## Objective

Создать цифровую систему для еженедельной отчетности Центра Спортивных Единоборств (ЦСЕ), заменяющую ручной Excel-файл. Система должна автоматизировать сбор данных по дисциплинам, филиалам и тренерам, агрегировать статистику и предоставлять единое окно для руководства.

**Пользователи:**
- Тренеры — вводят данные по своим группам
- Руководители филиалов — сводят данные по городу
- Руководство ЦСЕ — смотрит общую статистику

**Критерии успеха:**
- Еженедельный отчет формируется за 5 минут вместо 2-3 часов
- Данные по всем филиалам и дисциплинам в единой БД
- Автоматический подсчёт итогов (сейчас считают вручную)

## Терминология (из файла)

| Термин | Значение |
|--------|----------|
| ЦСЕ | Центр Спортивных Единоборств |
| Филиал / Город | Локация (Ачинск, Братск, Волгоград и т.д.) |
| Дисциплина | Вид спорта (греко-римская борьба, бокс, дзюдо...) |
| Зачисленные | Дети, официально зачисленные в школу/центр |
| Платная основа | Занимающиеся на платной основе (дети + взрослые) |
| Бесплатная основа | Занимающиеся бесплатно, не зачисленные в школу |
| Мероприятия | Соревнования, мастер-классы, сборы |
| ИТОГО по всем ЦСЕ | Общий охват (4944 чел за неделю) |

## Команды

```bash
# Разработка (fastapi)
uvicorn app.main:app --reload

# Миграции БД
alembic revision --autogenerate -m "description"
alembic upgrade head

# Тесты
pytest tests/ -v --cov=app

# Линтер
ruff check . --fix
```

## Структура проекта (backend)

```
app/
├── modules/
│   ├── auth/           # авторизация и роли
│   ├── organizations/  # ЦСЕ, филиалы, города
│   ├── disciplines/    # виды спорта
│   ├── coaches/        # тренеры
│   ├── athletes/       # спортсмены и группы
│   ├── attendance/     # посещаемость
│   ├── events/         # мероприятия/соревнования
│   └── reports/        # генератор отчетов
├── core/
│   ├── database.py     # БД подключение
│   ├── security.py     # JWT/OAuth2
│   └── config.py       # настройки
├── models/             # SQLAlchemy модели
├── schemas/            # Pydantic схемы
└── main.py
```

## Модели данных (на основе Excel)

### organizations
- `id`, `name` (ЦСЕ), `type` (центр, федерация, клуб)

### branches (филиалы/города)
- `id`, `organization_id`, `city`, `address`, `phone`

### disciplines
- `id`, `name` (греко-римская борьба, бокс...), `category`

### coaches
- `id`, `user_id`, `branch_id`, `discipline_id`, `phone`, `specialization`

### athletes
- `id`, `full_name`, `birth_date`, `branch_id`, `coach_id`
- `enrollment_type` (enrolled / paid / free)
- `rank`, `medical_notes`

### groups
- `id`, `name`, `branch_id`, `discipline_id`, `coach_id`, `schedule`

### events
- `id`, `name`, `discipline_id`, `date_from`, `date_to`, `city`
- `status` (municipal, regional, federal)
- `participants_total`, `participants_cse`

### event_results
- `id`, `event_id`, `athlete_id`, `place`, `medal`

### weekly_reports
- `id`, `branch_id`, `discipline_id`, `week_start`, `week_end`
- `children_enrolled`, `children_attended` — зачисленные
- `paid_total` — платная основа
- `free_total` — бесплатная основа
- `event_participants` — участники мероприятий
- `created_by`, `created_at`, `status` (draft, submitted, approved)

### report_comments
- `id`, `weekly_report_id`, `text` (свободный комментарий по типу "Братск: Перикальский Д.В. - 35 чел.")

## Стиль кода (Python/FastAPI)

```python
# Пример стиля — сервисный слой
from sqlalchemy import select
from app.models.weekly_report import WeeklyReport

class ReportService:
    async def get_branch_summary(self, branch_id: int, week: date) -> dict:
        stmt = select(WeeklyReport).where(
            WeeklyReport.branch_id == branch_id,
            WeeklyReport.week_start == week,
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
```

**Конвенции:**
- Асинхронные ендпоинты (async/await)
- Сервисный слой (endpoints → services → repositories)
- Аннотации типов обязательны
- Модели SQLAlchemy — в `models/`, Pydantic схемы — в `schemas/`
- Имена: `snake_case` для переменных, `PascalCase` для классов, `UPPER_CASE` для констант

## Стратегия тестирования

- **pytest** + httpx (async test client)
- Тесты рядом с кодом: `app/modules/reports/tests/`
- Unit-тесты: сервисный слой (моки БД)
- Integration: API endpoints с тестовой БД
- Coverage: >= 80%

## Границы (Boundaries)

**Всегда:**
- Валидировать входные данные (Pydantic)
- Указывать type hints
- Писать тесты на новую логику
- Коммитить после каждого завершённого модуля

**Спрашивать перед:**
- Изменением схемы БД
- Добавлением новой зависимости
- Изменением архитектуры (переход на другую БД, кэш)

**Никогда:**
- Не коммитить .env, secrets
- Не использовать сырые SQL-запросы в обход ORM
- Не удалять тесты без согласования

## Критерии приёмки v1

- [ ] CRUD филиалов, дисциплин, тренеров
- [ ] CRUD спортсменов с привязкой к филиалу, дисциплине, тренеру
- [ ] Ввод еженедельных данных (аналог строки Excel)
- [ ] Автоматический подсчёт итогов по дисциплине, филиалу, общих
- [ ] Комментарии произвольным текстом (список тренеров, кол-во по городам)
- [ ] CRUD мероприятий и результатов
- [ ] Роли: тренер (ввод), руководитель филиала (проверка), администратор (всё)
- [ ] Экспорт отчёта в Excel (аналог текущего файла)
- [ ] Dashboard с итогами (общее кол-во, платные/бесплатные, мероприятия)

## Открытые вопросы

1. Нужна ли авторизация через Telegram / OAuth?
2. Импорт существующего Excel — нужен разовый скрипт или интерфейс?
3. Хранить ли полную историю спортсменов (переходы между группами)?
4. Нужен ли учёт финансовых платежей (суммы) или только количественный?
