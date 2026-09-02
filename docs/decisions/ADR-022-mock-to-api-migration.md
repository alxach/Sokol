# ADR-022: Перенос оставшихся модулей с мок-данных на реальный API

Статус: Proposed → Accepted (2026-08-29)

## Проблема

Часть фронтенда по-прежнему обслуживается статическими данными из `frontend/src/lib/mock-data.ts`, хотя бэкенд уже предоставляет полноценные API-эндпоинты. Это ломает аудит, расчёты и администрирование реального продукта: в демо-режиме пользователь видеет фиктивных спортсменов, фиктивные показатели дашборда, фиктивные центры в контексте.

## Остаток моков (инвентаризация)

Файлы, импортирующие и реально использующие `mock-data.ts` в рендере:

| Файл | Что использует | Статус API |
|------|----------------|------------|
| `src/lib/center.tsx` | `centers[0].id`, массив `centers` | `fetchCenters()` готов (GET `/organizations/centers`) |
| `src/routes/index.tsx` | `athletes`, `schedules`, `schedulePeriods`, `attendanceRecords`, `disciplineMix`, `monthlyResults`, `recentActivity`, `centers`, `getCenterIdByCity()`, `getPeriodStatus()` | `fetchAnalyticsSummary()`, `fetchPlans()`, `fetchCriteria()` — готовы |
| `src/routes/plans.tsx` / `plans/new.tsx` | типы `Plan`, `PlanItem`, `PlanStatus`, `PlanCategoryId` + `planCategories`, `planCategoryKeys` | функции на API, типы/категории из мока |
| `src/routes/reports.tsx` | `calculateGross`, `calculateNdf`, `calculateInsurance` | математика дублирует `incentive_calc.py` (Приложение №6) |
| `src/routes/reports/new.tsx` | `PlanItem` тип | legacy |

**Не считаются остатком** (либо уже API):

- `src/routes/athletes.tsx` — импортирует `fetchAthletes/createAthlete/updateAthlete/deleteAthlete` из `lib/api/athletes.functions.ts`, **не импортирует** `mock-data.ts`. Список/редактирование — уже на API (но см. в ветке А).
- `src/routes/competitions.tsx` — импортирует из `lib/api/events.functions.ts` (`fetchCompetitions`/`createCompetition`/`updateCompetition`/`deleteCompetitionEvent`/`cancelCompetition`/`addCompetitionParticipant`/`removeCompetitionParticipant`/`setCompetitionResult`/`clearCompetitionResult`) — уже на API.
- `src/routes/attendance.tsx` — импортирует из `lib/api/attendance.functions.ts` (`fetchAttendanceJournal`/`fetchAttendance`/`markAttendance`/`batchAttendance`/`updateAttendance`/`deleteAttendanceRecord`) — уже на API (но см. в ветке Б).
- `src/lib/api/exports.functions.ts` — legacy зоде-сервис, не входит в миграцию.

## Принятое решение

### Принцип перехода

**«Минимизировать поверхностный API, переиспользовать готовые сервисы, добавлять эндпоинты только когда реальные данные не покрываются».**

Рекомендованный порядок этапов (ниже).

---

### Этап 1. Реальные центры в контексте (`lib/center.tsx`)

**Решение:** в `CenterProvider` вызвать `fetchCenters()` (из `lib/api/organizations.functions.ts`), инициализировать `centers` и `selectedCenterId` реальными данными. При `selectedCenterId == null` UI-выбор должен оставаться рабочим.

**Инвентаризация зависимостей `useCenter()`:**
- `src/routes/schedules.tsx` — использует `selectedCenterId` для фильтрации периода/групп (тренер-фильтр).
- `src/routes/index.tsx` — использует `selectedCenterId` для фильтрации дашборда.
- `src/routes/plans.tsx` — не использует напрямую, но может.

**Влияние:** при замене статического контекста на API-контекст это касается всех модулей, использующих `useCenter()`.

**Проверка эндпоинта:** GET `/organizations/centers` — должен быть доступен без аутентификации (или с `get_current_user` для всех). Если требует admin/director — тогда контекст пустой для тренера; спросить дорешивать доступ. Бэкенд `router.py organizations` — проверю.

### Этап 2. Дашборд (`src/routes/index.tsx`) — двухэтапный перенос

**Этап 2А (внешние сущности, без тяжёлых статистик):**
- `topAthletes` → `fetchAthletes()` (возвращает `items: AthleteDto[]`); на фронте сортить по `rating` (но у атлет API нет `rating`… возможно поле отсутствует. Доопределить: либо добавить `rating` в athlete API, либо использовать другой ключ, либо воздержаться). Доопросить.
- `myAthletes` → same `fetchAthletes()` + фильтр по `coach_name` === `user.coachName`.
- `mySchedulesToday` → `fetchSchedulePeriods()` (`/schedules/periods` с `coach_user_id`/`center_id`) + `effectiveStatus` (backend: status `draft|active|archived`, `today > period_end` → archived) — переписать.
- `myAttendance` → `fetchAttendance()` (`/attendance`) с фильтром `date` + `athleteId` перечня.
- `recentActivity` → создать эндпоинт `/analytics/activity` (последние события). Если нельзя быстро — на фронте комбинировать `fetchEvents()` + `fetchCompetitions()` пока ad-hoc, но это «пускает» моки — значит добавить эндпоинт.
- `centers` для директора → `fetchCenters()`, `getCenterIdByCity` ≈ сопоставление имени центра.

**Этап 2Б (статистики):**
- Блоки `medals`, `athletes_by_status`, `athletes_by_discipline`, `coach_workload`, `medal_dynamics`, `top_athletes` покрываются `fetchAnalyticsSummary()` (эндпоинт `/analytics/summary`). Заменить статику на эти данные.
- `monthlyResults` (медали по месяцам) — покрывается `medal_dynamics` из analytics.
- `disciplineMix`, `athletes_by_discipline` — покрывается `athletes_by_discipline` из analytics.

**Риски:** 
- `topAthletes` требует `rating`, а athlete API может не иметь `rating`. Добавить поле `rating` в athlete API (миграция) или заменить сортировку на другой ключ (medals).
- `recentActivity` требует эндпоинт. Создать `/analytics/activity` (последние N событий кросс-модульных). Это отдельный кусок.

### Этап 3. Категории мероприятий как API

**Решение:** добавить эндпоинт `GET /incentive/plan-categories` (статика enum категорий «СВ», «ТР», «МР», «ПР», «РС» и label) → фронт заменят `planCategories`/`planCategoryKeys` из мока на API-данные.

**Альтернатива:** оставить статику пока, если список категорий не меняется и локализация не требуется. Но для единообразия — добавить.

**Риск:** ADR-020 уже добавил incentive_program/commission — легко добавить ещё categories.

### Этап 4. Отчёты — расчётные функции

**Решение:** устранить дубликат математики `calculateGross/calculateNdf/calculateInsurance` из mock-data → заменить на reference к серверному расчёту (или эндпоинт `/incentive/calc-breakdown`, или подгрузку расчёта из инсайт-кальк). В reports.tsx расчёт используется для показа в форме создания отчёта (new.tsx)? Проверить, genuine требуется.

Если математика идентична `incentive_calc.py` — можно зеркалить функцию на фронте (copy-paste), но это дальнейшее рассинхронизирование. Лучше эндпоинт расчёта или серверный расчёт во время submit (на нынешнем уровне button).

### Этап 5. Подтверждение `athletes.tsx` и `attendance.tsx`

**Проверить** `athletes.tsx` — не использует ли статику из mock-data где-то внутри (форма создания, статус-bars). Если полностью API — вычеркнуть из мок-листа.

**Проверить** `attendance.tsx` — использование `fetchAttendanceJournal`/`batchAttendance` — полный переход? Может быть UI-части на статике.

### Этап 6. Legacy `exports.functions.ts`

Файл `lib/api/exports.functions.ts` — legacy зоде-сервис с рукописными Excel шаблонами на статических типах. Не подлежит переносу. Фиксируется как «legacy, вынесен в долгосрочный бэклог или заменён на бэкенд-экспорты (ADR-019/ADR-021 имеет exports service?)». Наиболее разумное — залить бэкенд-экспорты (ADR-021 упоминает exports service `excel_export_service.py`) и на фронте точками.

### Этап 7. Оценка полного удаления `mock-data.ts`

Когда весь статический контент переведён на API и типы дублированы вынесены — оценить удаление. Но mock-data.ts может служить seed для тестов; удалять только с явным решением.

---

## Этапы в порядке (рекомендуемый)

| № | Этап | Файлы | Примечание |
|---|------|-------|------------|
| 1 | Реальные центры в контексте | `lib/center.tsx`, роутер org.GET | Зависимости `useCenter()` во всех модулях |
| 2А | Дашборд: внешние сущности | `routes/index.tsx` | `fetchAthletes`, `fetchSchedulePeriods`, `fetchAttendance`, `fetchCenters`, `fetchAnalyticsSummary` |
| 2Б | Дашборд: статистики + эндпоинты | `routes/index.tsx`, backend `/analytics/activity` | `recentActivity` требует эндпоинт |
| 3 | Категории мероприятий API | backend `/incentive/plan-categories` + `routes/plans.tsx` | эндпоинт маленький |
| 4 | Отчёты — расчёт функции | `routes/reports.tsx`, backend `/incentive/calc-breakdown` (опц.) | опционально, зависит от ¿использование |
| 5 | *Проверить* `athletes.tsx`, `attendance.tsx` | `routes/athletes.tsx`, `routes/attendance.tsx` | убедиться чистота |
| 6 | Legacy `exports.functions.ts` | — | замерить или ждать бэкенд-экспорты ADR-021 |
| 7 | (опционально) удаление `mock-data.ts` | — | только если все зависимости убраны |

---

## Найденные риски и открытые вопросы

| № | Вопрос | Статус | Решение |
|---|--------|--------|---------|
| R1 | `topAthletes` требует `rating`; athlete API может не иметь этого поля | Open | добавить поле `rating` в athlete API (миграция), либо заменить сортировку |
| R2 | `recentActivity` требует эндпоинт `/analytics/activity` | Open | создать эндпоинт (кросс-модульный aggregate) |
| R3 | `getCenterIdByCity()` / `getPeriodStatus()` — статичные хелперы, должны переписаться под API | Open | переписать под API-данные |
| R4 | GET `/organizations/centers` — доступен ли без роли? | Open | проверить router org |
| R5 | `planCategories` — добавить эндпоинт или оставить stat? | Open | добавить — единообразие |
| R6 | reports.tsx расчётные функции — genuine требуется в UI? | Open | проверить new.tsx usage |
| R7 | athletes.tsx — сохраняется ли где статика? | Open | полное чтение файла |

---

## Ссылки

- ADR-021 (Security Hardening, RBAC) — `docs/decisions/ADR-021-security-hardening.md`
- ADR-020 (Schema Audit) — `docs/decisions/ADR-020-schema-audit.md`
- Бэкенд API эндпоинты: `backend/app/modules/*/router.py`
- Фронтенд API-клиент: `frontend/src/lib/api/client.ts`
- Готовые API-функции: `frontend/src/lib/api/*.functions.ts`
