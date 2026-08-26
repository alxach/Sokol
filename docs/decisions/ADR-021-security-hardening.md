# ADR-021: Security Hardening — авторизация API и серверные бизнес-правила

## Status
Accepted

## Date
2026-08-23

## Context

Глубокий аудит проекта (индексация SocratiCode 941 чанк, dependency graph 337 файлов / 5899 символов, ручная верификация) выявил критические пробелы безопасности:

1. **63 из 68 эндпоинтов не требуют аутентификации.** `Depends(get_current_user_id)` есть только в `users` и `audit` роутерах. Роутеры `incentive` (12 эндпоинтов, деньги), `exports` (дамп всех ПДн), `athletes` (медкарты) — полностью открыты.
2. **Роли никогда не проверяются.** Роли кладутся в JWT (`security.py:21`), но ни один эндпоинт их не читает. 60 seeded permissions в `core/seed.py` — мёртвый код. Любой аутентифицированный (и даже неаутентифицированный) пользователь может удалить пользователя, утвердить отчёт или скачать весь дамп.
3. **Финансовые расчёты регламента ред.8 только на клиенте.** Расчёт gross/НДФЛ/взносы/net и лимиты (п.3.1.4 ≤3 уч., п.3.2.3 ≤5%, п.4.3 ≤30%) живут в `frontend/src/lib/api/incentive-validation.ts`. `IncentiveService` — CRUD pass-through без валидаций: бэкенд примет любые суммы.
4. **Статусная модель отчётов не enforced на бэкенде.** `ReportService` — CRUD без переходов draft→submitted→approved/rejected.
5. **JWT-секрет по умолчанию** `"change-me-in-production"` без проверки на старте.
6. **Тестов нет**: `backend/tests/` содержит только `__init__.py`; CI-джоба pytest холостая.

При этом `docs/api-schema.md` задаёт полную матрицу доступа по ролям — она никогда не была реализована.

## Decision

### 1. Авторизация через роли из JWT + фабрика зависимостей

Роли читаются из claim `roles` access-токена (TTL 30 мин — приемлемое окно устаревания; отзыв ролей вступает в силу при refresh). Проверка по БД на каждый запрос отложена (см. Deferred).

```python
@dataclass
class CurrentUser:
    id: str
    roles: list[str]

async def get_current_user(...) -> CurrentUser          # 401 если нет/битый токен
def require_roles(*allowed: str) -> Depends             # 403 если роль не входит; superadmin — bypass
```

Соглашения: отсутствие/невалидный токен → **401**; токен валиден, роль не подходит → **403**.

### 2. Fail-fast валидация секрета

`Settings` валидируется при старте: пустой или дефолтный `JWT_SECRET_KEY` при `DEBUG=False` → падение приложения с понятной ошибкой.

### 3. Матрица доступа по роутерам (из api-schema.md)

| Роутер | Доступ |
|--------|--------|
| athletes, groups, schedules, attendance, events, documents, reports | coach, admin, director (+superadmin везде) |
| coaches | admin, director (GET — также coach) |
| incentive plans | coach, admin, director |
| incentive protocols/payouts | admin, director |
| exports | admin, director |
| organizations: regions | все авторизованные |
| organizations: centers (запись) | director (create), superadmin (delete) |
| users, audit-logs | admin, director |
| auth: login/register/refresh | публичные; `/auth/me` — любой авторизованный |

Владение объектами (coach редактирует только своих спортсменов) и center-scoping — отдельная задача (см. Deferred).

### 4. Серверные расчёты программы стимулирования

`IncentiveService` получает чистые функции расчёта (модуль `app/services/incentive_calc.py`):

- `calculate_payout(amount_gross)` → `{ndfl, insurance, net}` по Приложению №6 (НДФЛ 13%, взносы 30%).
- `validate_payout_amount(tier, amount)` — лимиты тиров (≥50К / ≥25К).
- `add_payout_row()` пересчитывает net на сервере, игнорируя клиентские значения; суммы валидируются против лимитов регламента.

### 5. Статусная модель отчётов на бэкенде

`ReportService.submit/approve/reject` с валидацией переходов:

```
draft → submitted (coach)
submitted → approved | rejected (admin, director)
```

Недопустимый переход → 422. Права проверяются через `require_roles`.

### 6. Тесты как фиксация матрицы

- `conftest.py`: async-движок на PostgreSQL (docker compose dev / CI service), `metadata.create_all`, фикстуры пользователей всех ролей с известными паролями, хелпер авторизации.
- `test_rbac_matrix.py`: для каждого защищаемого префикса — 401 без токена, 403 с чужой ролью, 200/2xx с допустимой ролью.
- `test_incentive_calc.py`: математика выплат и лимиты.
- `test_reports_workflow.py`: переходы статусов и права.

## Task List

### Phase 1 — Auth foundation
| Task | Описание | Scope | Критерий |
|------|----------|-------|----------|
| 1 | `CurrentUser`, `get_current_user`, `require_roles` в `core/dependencies.py` | S | Импортируется, 401/403 семантика |
| 2 | Валидация `JWT_SECRET_KEY` в `config.py` | XS | Старт с дефолтом при DEBUG=False падает |
| 3 | Применить `require_roles` к 15 роутерам | M | Ни один бизнес-эндпоинт не отвечает без токена |

**Checkpoint:** ruff чист; ручной curl: 401/403 работают.

### Phase 2 — Server-side business rules
| Task | Описание | Scope | Критерий |
|------|----------|-------|----------|
| 4 | `incentive_calc.py` + интеграция в `IncentiveService.add_payout_row` | M | Net считается на сервере; лимиты enforced |
| 5 | `ReportService.submit/approve/reject` + роуты | M | Переходы и роли enforced |

**Checkpoint:** ruff чист.

### Phase 3 — Tests
| Task | Описание | Scope | Критерий |
|------|----------|-------|----------|
| 6 | `conftest.py` + фикстуры ролей | M | pytest собирает окружение |
| 7 | RBAC-матрица по всем роутерам | S | 401/403/200 покрыты |
| 8 | Тесты расчёта выплат | S | Математика + лимиты |
| 9 | Тесты workflow отчётов | S | Переходы + права |

**Checkpoint:** `pytest -v` зелёный локально и в CI.

### Phase 4 — Cleanup
| Task | Описание | Scope | Критерий |
|------|----------|-------|----------|
| 10 | `exports/router.py` → `ExcelExportService` | S | Роутер тонкий, слоение восстановлено |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Фронтенд на mock-data, поэтому включение auth не сломает UI | Low | Фронт ещё не ходит в API массово; ломать нечего |
| Токены, выпущенные до внедрения, не содержат roles | Low | `roles=None` → трактуем как «нет прав», кроме публичных эндпоинтов; пользователи перелогинятся |
| Тесты требуют PostgreSQL | Medium | docker compose dev локально; postgres-service уже есть в CI |
| `metadata.create_all` vs миграции расходятся | Low | ADR-020 подтвердил синхронность; для тестов create_all достаточно |

## Deferred (отдельные ADR)

- **Center-scoping**: фильтрация данных по центру пользователя на уровне репозиториев (требует прокидывания контекста пользователя во все сервисы).
- **Проверка владения**: coach редактирует только своих спортсменов/группы.
- **Refresh-ротация и blacklist**, rate limiting на `/auth/login`.
- **Замена python-jose** (не поддерживается) на PyJWT/Authlib.

## Consequences

- Все 68 эндпоинтов получают аутентификацию; бизнес-эндпоинты — авторизацию по ролям.
- Финансовые расчёты становятся server-authoritative.
- CI впервые реально запускает тесты; матрица доступа зафиксирована регрессионными тестами.
- Клиентская валидация `incentive-validation.ts` остаётся как UX-подсказки, но перестаёт быть единственным барьером.
