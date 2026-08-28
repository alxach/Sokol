# ADR-006: План мероприятий тренера (Plan module)

## Статус
Accepted (implemented 2026-08-28)

## Дата
2026-06-20

## Контекст

В системе «СОКОЛ» тренерам необходимо планировать мероприятия на год по трём категориям: соревнования/турниры, мастер-классы, сборы/выезды. Мероприятия распределяются по кварталам и месяцам внутри годового плана. Текущая реализация на моках не имеет бэкенда и бизнес-логики утверждения.

Требования:
- Тренер создаёт один план на год с набором мероприятий (до 50 шт.)
- Каждое мероприятие привязано к кварталу (1–4) и месяцу
- Каждое мероприятие утверждается индивидуально руководителем центра
- План должен быть привязан к тренеру, его дисциплине и центру
- Тренер видит только свои планы, руководитель — все планы своего центра
- После утверждения/отклонения редактирование недоступно
- План можно создать в любой момент года, но только один на год

## Decision

### Бизнес-логика

1. **Кто создаёт:** только тренер (coach)
2. **Кто утверждает:** admin своего центра, director (любого центра)
3. **Статусная модель** — индивидуальна для каждого мероприятия (item) в плане:

```
draft → submitted → approved
                 → rejected (→ draft — повторная отправка)
```

Сам план не имеет общего статуса — его состояние агрегируется из статусов мероприятий.

4. **Период:** один план = один год. У тренера может быть только один план на год. При попытке создать второй — показывается существующий. План можно создать в любой момент года.

5. **Ограничения:**
   - Тренер не может удалить план целиком — только мероприятия в статусе `draft`
   - После отправки на проверку мероприятие нельзя редактировать
   - После утверждения/отклонения все поля read-only
   - При отклонении admin указывает комментарий — обязательное поле

### Модель данных

```
Plan:
  id             uuid PK
  coach_id       uuid FK → coaches.id
  center_id      uuid FK → centers.id
  discipline     varchar(100)
  year           int
  coach_name     varchar(200)     — денормализация для списка
  coach_initials varchar(10)      — денормализация для аватарки
  created_at     timestamptz
  updated_at     timestamptz

PlanItem:
  id                  uuid PK
  plan_id             uuid FK → plans.id ON DELETE CASCADE
  category_id         int (1=соревнования, 2=мастер-классы, 3=сборы/выезды)
  quarter             int (1-4)
  month               varchar(20)   — «Январь», «Февраль»…
  date                varchar(20)   — «ДД.ММ.ГГГГ»
  name                varchar(300)
  description         text
  location            varchar(200)
  participants_category varchar(200)
  participants_count  int
  status              varchar(20)   — draft | submitted | approved | rejected
  submitted_at        timestamptz?
  reviewer_comment    text?
  reviewer_name       varchar(200)?
  reviewed_at         timestamptz?
  created_at          timestamptz
  updated_at          timestamptz
```

Связи:
- `Plan` N:1 → `Coach`
- `Plan` N:1 → `Center`
- `PlanItem` N:1 → `Plan` (cascade delete)

### API спецификация (REST)

| Метод | Endpoint | Роль | Описание |
|-------|----------|------|----------|
| GET | `/api/v1/plans` | coach, admin, director | Список планов (coach → только свои, admin → свой центр, director → по `?center_id=`) |
| GET | `/api/v1/plans/:id` | coach, admin, director | Детали плана с items |
| POST | `/api/v1/plans` | coach | Создать план (пустой, без items) |
| PUT | `/api/v1/plans/:id` | coach | Обновить мета-поля плана (только draft) |
| DELETE | `/api/v1/plans/:id` | admin | Удалить план целиком |
| POST | `/api/v1/plans/:id/items` | coach | Добавить мероприятие (пока план не отправлен) |
| PUT | `/api/v1/plans/items/:itemId` | coach | Редактировать мероприятие (только draft) |
| DELETE | `/api/v1/plans/items/:itemId` | coach | Удалить мероприятие (только draft) |
| POST | `/api/v1/plans/items/:itemId/submit` | coach | Отправить на проверку (draft → submitted) |
| POST | `/api/v1/plans/items/:itemId/approve` | admin, director | Утвердить (submitted → approved) |
| POST | `/api/v1/plans/items/:itemId/reject` | admin, director | Отклонить (submitted → rejected, тело: `{ comment: string }`) |
| GET | `/api/v1/plans?year=YYYY` | — | Фильтр по году |

### UX/UI тренера

**Навигация:** пункт «План мероприятий» (`CalendarPlus`) в sidebar тренера между «Соревнования» и «Отчёты».

**Список (`/plans`):**
- **Роль тренера:** inline-отображение всех мероприятий текущего годового плана на странице, сгруппированных по кварталам → месяцам. Убирается таблица, план показывается сразу.
  - Вверху: заголовок с годом, ФИО тренера, вид спорта, агрегированный статус
  - Фильтры: по кварталу (1/2/3/4) и по статусу мероприятия (draft/submitted/approved/rejected). Скрывают соответствующие кварталы и карточки.
  - Карточки мероприятий по кварталам/месяцам (как в `PlanDetailModal`)
  - Кнопка «Добавить мероприятие» внизу списка — открывает форму inline
  - Удаление только для draft (через иконку корзины)
  - Отправка на проверку для каждого draft-мероприятия индивидуально
  - Если плана на текущий год нет — hero-блок с кнопкой «Создать план на год»
  - Кнопка «Создать план на год» (если нет плана на текущий год)
- **Роль admin/director:** таблица с фильтрами по статусу/кварталу/поиску. Кнопка «Открыть» → модалка `PlanDetailModal` для утверждения/отклонения.

**Создание (`/plans/new`):**
- Выбор года (по умолчанию текущий)
- ФИО тренера и вид спорта — автоматически, read-only
- Добавление мероприятий карточками: квартал, месяц, категория, дата, название, описание, место, категория участников, количество участников
- Счётчик мероприятий по категориям

**Модалка просмотра (`PlanDetailModal`):**
- Используется только admin/director для утверждения/отклонения
- Тренер использует inline-отображение на `/plans` вместо модалки
- Группировка по кварталам → месяцам
- Admin/director: утвердить/отклонить submitted. При отклонении — обязательный комментарий
- Подпись тренера внизу

## Implementation notes (2026-08-28)

Бэкенд-воркфлоу и фронтенд переведены со моков на реальный API. Отклонения от спеки выше:

- **Неймспейс:** всё живёт в существующем инцентив-модуле `/api/v1/incentive/plans` (см. ADR-019), а не отдельный `/api/v1/plans`.
- **Создание плана — get-or-create:** `POST /plans` возвращает существующий план на тот же `(coach_id, year)` с `200`, а не 409. Тренер может иметь план на любой год, не только текущий.
- **Статусная модель дополнена `redraft`:** `submitted → reject → draft` (только coach-владелец) → повторный submit. `POST /plans/items/{id}/redraft`; `/submit` валид только из `draft`; `approve`/`reject` — только из `submitted` (иначе 422).
- **Comment обязателен** при reject (422 при пустой строке).
- **Роли:** создание плана/мероприятий — только coach (superadmin добавляет с явными `coach_id`/`center_id`); проверка (`approve`/`reject`) — admin своего центра, director (все центры), superadmin. `require_roles("admin","director")` на роуте.
- **Scoping:** coach — только свои планы; admin — только планы своего центра (`users.center_id`); director/superadmin — все (+ фильтры `center_id`, `year`).
- **Правки мероприятий:** `PUT/DELETE /plans/items/{id}` — только `draft`, кроме суперадмина.
- **Агрегат плана:** `status` плана вычисляется из items: любой `submitted` → submitted; иначе любой `rejected` → rejected; иначе все `approved` → approved; иначе draft.
- **Month — число** (1–12) на бэке (фронт маппит в «Январь»…); категория — строка (`"3"|"4"|"5"` из Приложения №5 Положения), на фронте в `planCategories`.
- **`coach_user_id`** добавлен в `EventPlanOut` — профиль тренера (`coach_id`) ≠ id пользователя; фронт фильтрует планы по `coach_user_id`.
- **Draft-правки коуча:** submit/redraft/delete — асинхронные вызовы API + `onChanged` refetch; admin/director approve/reject — через модалку с полем обязательного комментария.
- **Импорт из Excel** — раскрывает план года (get-or-create для коуча; для admin/director — поиск плана по `coachName` + год, иначе alert), затем `POST` items.
- Миграция `e1f2a3b4c5d6` (`reviewer_comment`/`submitted_at` на `plan_items`) применена к dev-БД.
- Тесты: `backend/tests/test_plans_workflow.py` (9 кейсов); весь набор — 60/60 зелёные. Ruff чист.
- Файлы: `backend/app/schemas/incentive.py`, `backend/app/services/incentive_service.py`, `backend/app/dependencies.py`, `backend/app/modules/incentive/router.py`, `frontend/src/lib/api/plans.functions.ts`, `frontend/src/routes/plans.tsx`.

### Закрытие расхождений со спекой (2026-08-28, аудит plans ↔ ADR-006/coach-spec/admin-spec)

- **`PUT /incentive/plans/{plan_id}`** — правка меты плана (coach владелец, директор/superadmin; 422 если не `draft` по агрегату; `coach_id`/`center_id` нередактируемы запросом тренера).
- **`DELETE /incentive/plans/{plan_id}`** — удаление плана целиком (admin своего центра, director, superadmin; каскад item-ов по FK `ON DELETE CASCADE`); тренеру запрещено.
- **`PUT /incentive/plans/items/{itemId}`** — редактирование элемента плана (только `draft`, кроме суперадмина).
- **`/plans/new`** переписан на API: выбор года (2025–2027), `ensurePlan(year)`, локальные карточки, пакетное «Сохранить черновик» / «Отправить на проверку» (save всех новых + submit всех draft), счётчик категорий, редактирование в карточках, read-only для не-draft, фильтр по роли (только coach).
- **Дашборд:** тренерская карточка «Планы мероприятий» — сводка по кварталам текущего года из API (coach-spec §2.41); admin/director/superadmin — блок «Дедлайны планов» (admin-spec §2.34): планы с незакрытым кварталом и дедлайном ≤14 дней (🟡) или просроченные (🔴).
- **`/plans` (coach-вид):** добавлён счётчик мероприятий по категориям, индикатор дедлайна, баннер п. 3.1.3; директору — фильтр по центру (`GET /organizations/centers`), в модалке плана — «Удалить план» для admin/director.
- Тесты: `test_plans_workflow.py` += `test_update_plan_draft_only_and_roles`, `test_delete_plan_admin_only`; весь набор — 62/62 зелёные. Ruff и tsc без новых ошибок.

## Alternatives Considered

1. **Общий статус для всего плана** — rejected. На практике admin может утвердить одни мероприятия и отклонить другие в одном плане. Индивидуальный статус гибче.
2. **Утверждение плана админом центра целиком** — rejected. Руководитель должен видеть детали каждого мероприятия.
3. **Без бэкенда, оставить на моках** — rejected. Для реального использования нужна БД и API.

## Consequences

- Необходимо создать модель `Plan` + `PlanItem` в `backend/app/models/plan.py`
- Миграция Alembic для двух таблиц
- CRUD-сервис, схемы Pydantic, роутер `v1/plans`
- Добавить роутер планов в `backend/app/api/v1/__init__.py`
- Добавить пункт «План мероприятий» в `coach-spec.md` раздел 1 (навигация)
- Фронтенд: перевести `plans.tsx` и `plans/new.tsx` с моков на TanStack Query + API-клиент
- Фронтенд: добавить группировку мероприятий по кварталам внутри годового плана
- Фронтенд: для роли coach на `/plans` — inline-отображение карточек мероприятий вместо таблицы
- Фронтенд: добавить inline-добавление/удаление мероприятий в режиме coach
- Валидация `date` на бэке (некорректные даты)
- `Plan.quarter` удалён из модели — миграция с учётом обратной совместимости

## Notes

- `planCategories` на фронтенде: `{ 1: "Соревнования", 2: "Мастер-классы", 3: "Сборы и выезды" }` — может быть вынесен в справочник на бэке
- Текущий фронтенд (модалка `submitItem/approveItem/rejectItem`) мутирует моки напрямую — при подключении API эти функции станут вызовами `useMutation`
- В форме создания (`/plans/new`) селект месяца фильтруется по выбранному кварталу. При смене квартала месяц автоматически переключается на первый в новом квартале, если текущий месяц不属于 новому кварталу
