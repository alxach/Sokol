# Session Log: Sick Leave Feature + Documentation

## Date
2026-06-18

## Commits
1. `66291b5` — sick leave feature (backend + frontend)
2. `e4b2f39` — docs: ADR-002, coach-spec sections 10-11

## Key Implementation Details

### CoachSickLeave model (`backend/app/models/coach.py`)
- Отдельная таблица `coach_sick_leaves` (OneToMany к Coach)
- Поля: id, coach_id, start_date, end_date
- Полная аналогия с CoachVacation

### Pydantic schemas (`backend/app/schemas/coach.py`)
- `SickLeaveCreate` / `SickLeaveUpdate`
- `CoachCreate` / `CoachUpdate` / `CoachResponse` дополнены `sick_leaves`

### Service (`backend/app/services/coach_service.py`)
- `CoachService.create()` и `.update()` синхронизируют sick_leaves
- Алгоритм: delete absent, update existing, create new

### Frontend (`frontend/src/lib/mock-data.ts`)
- `VacationPeriod` переиспользован для sickLeaves
- `isOnSickLeave()` — проверка всех периодов
- `getCoachStatus()` приоритет: sick → vacation → status

### Profile (`frontend/src/routes/profile.tsx`)
- Карточка «Больничный» с DatePicker, add/remove
- ✏️-кнопка (независимый режим редактирования)
- Отдельный ключ localStorage: `sokol_coach_sick_leaves`
- `useEffect` синхронизации при `coachProfile.id`

### Coaches modal (`frontend/src/routes/coaches.tsx`)
- Секция «Больничный» в модалке с input[type=date]

### Auth fix (`frontend/src/lib/auth.tsx`)
- `coachName` — "Петров Александр Владимирович" (полное совпадение с mock-data)

### Edge-case (`frontend/src/lib/mock-data.ts:inPeriod`)
- Если `end < start` → период считается однодневным на start

## Documentation
- `docs/decisions/ADR-001-coach-vacation-periods.md` — архитектурное решение по отпускам
- `docs/decisions/ADR-002-coach-sick-leave-periods.md` — архитектурное решение по больничным
- `docs/coach-spec.md` — раздел 10 «Управление отпусками», раздел 11 «Управление больничными», обновлён раздел 8

## Known Issues
- `sokol-coach-app/` сборка падает с buffer/stream mismatch — не связано с изменениями
- В sidemenu флаг `/schedules` — не переименован (см. `app-sidebar.tsx`)
- `progress` в мок-данных имеет тип `any` — несоответствие CoachResponse

## Agentmemory (Session Memory) — BLOCKED

**HTTP API (port 3111) returns 404 on ALL endpoints** — III engine v0.11.2 на Windows.

- Docker контейнер `iiidev/iii:0.11.2` работает, порт слушается, routes registered в engine
- Но HTTP роутинг III engine не доставляет запросы до worker — всегда 404
- Native mode (`npx @agentmemory/agentmemory` без Docker) — та же 404
- `@agentmemory/mcp` (npx) запускается, падает на `livez` → 404, переходит в локальный InMemoryKV
- В локальном режиме MCP-сервер сохраняет в `~/.agentmemory/standalone.json`
- opencode (модель `big-pickle`) **не экспортирует MCP tools** — `memory_save` и др. отсутствуют
- Плагин `agentmemory-capture.ts` шлёт `POST /agentmemory/observe` → 404, silent-fail в try-catch

**Выход:** файловый fallback через `docs/session-log.md`

## Next Steps (from roadmap)
- Подключить реальное API для сохранения отпусков и больничных
- Убрать any у progress в CoachResponse
- Переименовать schedules → schedule в sidemenu
- Починить agentmemory HTTP API на Windows (III engine routing bug)

---

# Session Log: impeccable v4 update + PRODUCT.md migration + live-mode setup

## Date
2026-08-23

## Context
Продолжение сессии ADR-021 (см. память агента). Пользователь запросил аудит навыков дизайна, обновление impeccable и настройку live-mode перед перезапуском ПК.

## 1. Impeccable skill updated 3.9.1 -> 4.1.1
- Команда: `npx --yes impeccable update`
- Обновлены инсталляции: `.opencode/skills/impeccable/` + `.github/agents/` (Copilot), hooks в `.github`
- npm-пакет `impeccable` (3.6.0) — тёзка, НЕ источник обновлений. Источник: `https://impeccable.style/api/version`
- Кеш проверок: `~/.impeccable/update-check.json` (полл раз в сутки)
- v4 breaking changes: ось регистров brand/product заменена на 4 «режима посетителя»; удалены `reference/product.md`, `brand.md`, `codex.md`, `interaction-design.md`; добавлены `new-work.md`, `routing.md`, `visualize.md`, `operate.md`, `doctor.md`, `ios.md`, `android.md`, `craft-floor.md`, нативные варианты

## 2. PRODUCT.md migrated to v4 schema
- Стамп: `<!-- impeccable:product-schema 1 -->`
- Секция `## Register` удалена (упразднена в v4) — подтверждено пользователем
- Новые секции: Platform=web; Positioning (внутренняя система сети ЦСЕ, не SaaS); Operating Context (регламентный цикл ЦСЕ + ежедневная работа зала); Brand Commitments (обязательные и неизменные: SVG-логотип, Brandbook.pdf, цвета #467FC0/#09234C/#F4A838, Manrope/Inter); Evidence on Hand (реальные документы в корне репо — НЕ КОММИТИТЬ); Product Principles; Capabilities and Constraints (undecided: VK Mini App, QR, Flutter)

## 3. Live mode configured
- Конфиг: `frontend/.impeccable/live/config.json`
  - files: ["src/routes/__root.tsx"], insertBefore "<Scripts", commentSyntax jsx, cspChecked: true
- CSP не обнаружен (`detect-csp.mjs` -> shape null) — патч не требовался
- Boot: `node .opencode/skills/impeccable/scripts/live.mjs` из КОРНЯ репо -> ok:true, helper server port 8400, appRoot=frontend, context найден в корне

## Gotchas
- `live.mjs` запускать из корня `C:\Proj\Sokol`, не из `frontend/` — иначе `context_missing` (PRODUCT/DESIGN ищутся вверх от git root)
- Первичный boot при config_missing показывает путь конфига относительно app root
- Хвост `docs/session-log.md` (июньские секции) записан в CP1251 и побит — оставлен как есть, новые записи только UTF-8

## Uncommitted state (перед рестартом)
- ~20 файлов бекенда ADR-021 (RBAC, tests, incentive_calc) — НЕ закоммичены
- ~30 файлов обновления скилла (.opencode/skills/impeccable + .github)
- PRODUCT.md, docs/session-log.md, frontend/.impeccable/live/config.json
- git push --force на origin pending (история переписана filter-repo); bundle backup: C:\Users\alx\AppData\Local\Temp\opencode\sokol-pre-filter.bundle

## Next steps
- Закоммитить ADR-021 + обновление скилла (отдельными коммитами)
- Решить force-push
- Опционально: первая live-сессия (npm run dev -> браузер -> панель Impeccable)
## Session 2026-08-28: ADR-006 План мероприятий — backend + frontend

**Выполнено:**
1. Бэкенд-воркфлоу ADR-006 в инцентив-модуле `/api/v1/incentive/plans`: get-or-create (один план на (coach_id, year)), item-статусы draft→submitted→approved/rejected→redraft, reject с обязательным комментарием (422), роли (создание — coach, проверка — admin своего центра / director / superadmin), scoping + фильтры center_id/year, PUT/DELETE items только draft, агрегат статуса плана.
2. `EventPlanOut.coach_user_id` — профиль тренера ≠ id пользователя (фронт фильтрует планы по coach_user_id).
3. Frontend: новый `src/lib/api/plans.functions.ts` (мапперы месяц↔int, категории строковые, fetchPlans/ensurePlan/addItem/submit/approve/reject/redraft/delete). `plans.tsx` переписан: PlansPage на API (loading/error/CTA get-or-create), CoachPlanView — async submit/redraft/remove/add + «Вернуть в черновик», PlanDetailModal (approve/reject + обязательный комментарий, только admin/director), ImportButton на API (для коуча ensurePlan, для admin/director — поиск плана по тренеру+году).
4. Исправления при интеграции: директор больше не фильтрует планы по mock-id центра на клиенте (полагаемся на серверный scoping).
5. Проверки: ruff чист; 60/60 pytest (новые `tests/test_plans_workflow.py` — 9 тестов); tsc чист для plans.tsx и plans.functions.ts (в других файлах — только предсуществующие ошибки mock-страниц); браузерная проверка: coach (создать/redraft/submit), director (approve/reject c комментарием) — пройдена на dev (localhost:8080 + 8000).
6. ADR-006 дополнен секцией «Implementation notes (2026-08-28)».

**Грабли:**
- uvicorn --reload не применял изменения (WatchFiles завис) — перезапуск сервиса. При перезапуске убить и reloader (20976) и worker (2000).
- Страница после reload теряла сессию, controlled-форма логина не принимала fill → логин через fetch+localStorage (sokol_token).
- $PID в pwsh — зарезервировано (переменование).
- PowerShell ответы с кириллицей в консоли — краказябры (не влияет на данные).

**Открытое:** git коммит ADR-006 + force-push pending (история переписана); сверка severity в `test_plans_workflow.py` с test_rbac_matrix суперадмин-кейсов не проводилась; браузерная проверка суперадминки (/admin/users) остаётся отложенной.


---
## 2026-08-28 · plans: закрытие расхождений (аудит ↔ ADR-006/spec)

**Задача:** «закрывай все пункты, помни про тесты» — экраны планов сверены с ADR-006, coach-spec §9/§2.41, admin-spec §2.34.

**Backend:**
- `EventPlanUpdate` (schemas/incentive.py), `update_plan`/`delete_plan` (incentive_service.py), `PUT/DELETE /plans/{plan_id}` (router).
- update_plan: coach-владелец/director/superadmin; только при агрегатном status=draft (422); coach не меняет coach_id/center_id. delete_plan: admin своего центра/director/superadmin; coach 403; каскад по FK ON DELETE CASCADE.
- Тесты += test_update_plan_draft_only_and_roles, test_delete_plan_admin_only (фикстура set_admin_center). Итог 62/62 зелёные.

**Frontend:**
- `/plans/new` — полный реврайт на API (год 2025–2027, ensurePlan, локальные карточки, «Сохранить черновик»/«Отправить на проверку», счётчик категорий, read-only не-draft, только coach).
- `/plans` — exporter InlineItemForm? (нет, собственная форма), счётчик категорий + deadline-индикатор + плашка п.3.1.3 (CoachPlanView), «Удалить план» в модалке (admin/director), селектор центра директора через fetchCenters (новый organizations.functions.ts), единый helper `planDeadlineInfo` (export).
- index.tsx — тренерская «Планы мероприятий» (сводка по кварталам из API) + не-коуч «Дедлайны планов» (🔴/🟡).
- plans.functions.ts += PlanMetaUpdatePayload/updatePlan/deletePlan/updatePlanItem.

**Верификация:** tsc без новых ошибок (лишь предсуществующие User.coachName и пр.), ruff чист по изменённым файлам, vite build ok, live-смоук на всех 4 ролях (plans/new, coach view, дедлайны, селектор центра, кнопка удаления). ADR-006 обновлён.

**Замечание:** dev-БД: admin.center_id=NULL (center-scoping ADR-021 даёт 0 планов admin'у); план Соколовой привязан к другому coach_id (старый seed). Не баги.

---
## 2026-08-28 · criteria: утверждение критериев мат. стимулирования

**Задача:** критерии утверждает руководитель центра (admin) или руководитель центров (director); тренер — только просмотр выполнения на дашборде. Решения интервью: экран внутри «Программы» (/admin/programs, табы «Положения»/«Критерии»), объект — центр, прямое редактирование, бессрочно, 5 показателей.

**Backend:**
- models/incentive_criteria.py: IncentiveCriteria (id, center_id FK centers ON DELETE CASCADE + UniqueConstraint uq_incentive_criteria_center, updated_by FK users SET NULL, 10 полей: athletes/hours/social_events/sports_events/development_events × full/basic, hours Numeric(4,1), TimestampMixin). Миграция 5a6b7c8d9e0_add_incentive_criteria (revises e1f2a3b4c5d6) применена.
- 
epositories/incentive_repo.py: IncentiveCriteriaRepository.get_by_center. schemas/incentive.py: IncentiveCriteriaUpsert (validate_levels: basic ≤ full → 422), IncentiveCriteriaOut.
- incentive_service.py: get_criteria (coach — свой центр read; admin — свой центр; director/superadmin — любой/фильтр), upsert_criteria (coach 403, admin чужой центр 403).
- 
outer.py: GET /incentive/criteria, PUT /incentive/criteria/{center_id}. dependencies.py передаёт criteria_repo.
- Тесты 	est_criteria_workflow.py (=6): upsert admin свой центр 200/idempotent, admin чужой центр 403, director/superadmin любой центр, coach read 200/PUT 403, basic>full 422, director весь реестр с фильтром. pytest 68/68, ruff по изменённым — clean.

**Frontend:**
- lib/api/criteria.functions.ts (+DEFAULT_CRITERIA), admin/programs.tsx — табы «Положения»/«Критерии» (Положения: CRUD superadmin, read-only admin/director; Критерии: селектор центра у director/superadmin, фикс-центр у admin, форма 5×2, суммы из активной программы, «Утвердить критерии»).
- app-sidebar.tsx — «Программы» у admin/director (в модулях), у тренера осталось без изменений (Комиссия удалена ранее).
- index.tsx — блок «Критерии материального стимулирования» переведён с хардкода на GET /incentive/criteria: нормы из API, заглушка «не утверждены», current: спортсмены ≤21 (myAthletes.age), мероприятия — PlanItem плана тренера за текущий месяц по категориям 3/4/5; часы — 0 «по расписанию» (после подключения посещаемости).

**Верификация:** pytest 68/68, ruff clean, tsc без новых ошибок, vite build ok, live-смоук: тренер /admin/programs → «Доступ запрещён», директор — сохранение критериев (200 + «сохранены»), тренер-дашборд — реальные нормы 30/15, 9/4.5, 1/1/1 и «Мероприятия с особыми категориями 1/1 ✓», admin без центра — подсказка о привязке центра.

**Грабли:** в dev у admin.center_id=NULL — форма критериев (корректно) предлагает обратиться к руководителю. Текущие «часы» не появятся до интеграции посещаемости (след. итерация).

---
## Модуль «Спортсмены» — перевод с моков на реальный API (2026-08-28)

**Backend:**
- schemas/athlete.py: AthleteResponse расширен (coach_name/coach_user_id/center_name/center_city, id/center_id/coach_id -> uuid.UUID, created_at -> datetime, from_attributes).
- services/athlete_service.py: create/get/list/update возвращают обогащённый AthleteResponse (Coach/User/Center через IN), добавлен delete(athlete_id), _full_name().
- modules/athletes/router.py: новый DELETE /athletes/{athlete_id}.
- pytest 68/68, ruff изменённых файлов clean.

**Frontend:**
- lib/api/athletes.functions.ts: AthleteDto/AthleteStatusKey, calcAge(), athleteFullName(), athleteStatusLabels, fetchAthletes (парсинг [items,total]), create/update/delete.
- lib/api/coaches.functions.ts: CoachDto, fetchCoaches(), findCoachByUserId().
- routes/athletes.tsx: без mock; тренер видит только своих (coach_id через /coaches); колонки ID/ФИО/Дисциплина/Разряд/Тренер(только не-тренер)/Статус/Действия; MiniStat (Всего/Активные/Средний возраст/С разрядом); детальная карточка без вкладок; экспорт/импорт Excel (экспорт скрыт для тренера); повторный импорт подтверждается диалогом, создаёт спортсменов через createAthlete с фолбэками.
- components/athlete-modal.tsx: создание/редактирование через API; ФИО/дисциплина/разряд/дата рождения/пол/статус/примечание; без город/группы/медали/рейтинг.
- lib/api/exports.functions.ts: athleteSchema/колонки Excel переведены на реальные поля (id/name/discipline/rank/age/city/coach/status), убраны medals/rating/lastEvent.
- groups.tsx: вызов AthleteModal адаптирован к новому интерфейсу (временное состояние — модуль групп ещё на моках).

**Верификация:** tsc --noEmit чист по изменённым файлам (только предсуществующие exports Buffer/Stream + schedules focus), vite build ok (2.49s), live: coach — создание/редактирование (статус->Не тренируется, разряд КМС)/удаление через UI, admin — экспорт Excel ок; контракт GET /athletes и /coaches подтверждён.

**Решение:** таблица упрощена (без Медали/Рейтинг) по договорённости; город/тренер подтягиваются из связанных данных, иначе «—»; статус «Травма» убран (нет в backend enum).

**Осталось для следующего модуля:** группы -> расписание -> посещаемость -> соревнования -> тренеры -> отчёты/дашборд (остальные экраны всё ещё на мок-данных).

---

## 2026-08-28 — Модуль «Группы» переведён с моков на реальный API

**Backend (backend/app):**
- schemas/group.py: GroupResponse — UUID + from_attributes, добавлены schedule_note, created_at, обогащение (coach_name, coach_user_id, center_name, center_city, athlete_ids, athlete_count); новый GroupUpdate (PATCH semantics через model_fields_set).
- 
epositories/group_repo.py: GroupMemberRepository — find(group_id, athlete_id), remove(group_id, athlete_id) (composite PK), list_for_groups(group_ids).
- services/group_service.py: переписан по паттерну athlete_service — enrich coach/center через IN-выборки, update (сет поля из set), delete, add_member с default join_date=date.today() (колонка NOT NULL, схема допускала None), remove_member по составному ключу.
- modules/groups/router.py: добавлен PATCH /groups/{id}, DELETE /groups/{id}; DELETE /members/{member_id} заменён на DELETE /groups/{id}/members/{athlete_id}; 409 при дубле участника.
- 	ests/test_groups.py (+3): CRUD группы, coach_name enrich, add/member remove/duplicate(409)/404, RBAC. Итого pytest 71/71, ruff чист (изменённые файлы).

**Frontend (frontend/src):**
- lib/api/groups.functions.ts: GroupDto (на основе расширенного GroupResponse), group fetch/create/update/delete, add/remove member.
- 
outes/groups.tsx (~620 строк, было ~920): полностью на API, mock-импорты удалены. Список карточек (имя, sport_type, кол-во спортсменов, тренер для не-тренера), форма создания/редактирования (название, select вида спорта, описание→schedule_note, состав чекбоксами), детальная карточка (описание, дисциплина, тренер, плашка «Расписание — страница "Расписание"», состав с удалением участника и кнопкой «Добавить»), удаление группы с confirm. Тёрен-фильтр «Мои группы» по coach_user_id==user.id, director — по center_id группы. AddAthleteModal на реальных спортсменах + вкладка «Новый» (AthleteModal). Скорение «группа/группы/групп».

**Live-смоук (localhost:8080, coach@sokol.ru):** создан тестовый шлейф через API (регион→центр→тренер(Тестов)→спортсмен(Смоук)), затем через UI: создание группы «Группа юношей 2010» (ПОСТ 200, член добавлен), деталь с составом, удаление участника (Состав 1→0), добавление участника через модал (0→1), удаление группы через confirm (200). После каждого действия перезагрузка данных из API. В конце БД очищена (groups/members/athletes/coaches/centers = 0). МCP-грабли: window.confirm дублируется/прыгает под MCP (suppressed) — удаление группы в live проверено и через UI-диалог, и контрольным DELETE через API; MCP-клики на кнопки в не-hover-зоне нестабильны → использовать DOM .click() или evaluate.

**Verify:** tsc --noEmit (только предсуществующие exports.functions/schedules — не трогали), vite build 2.28s, pytest 71/71, ruff ok.

---
## 2026-08-28 — Модуль «Соревнования» переведён с моков на реальный API

**Backend (events):** models/event.py — Event.level/city (миграция aabbccdd0101, revises f5a6b7c8d9e0, применена к dev). schemas/event.py — EventCreate/Update + level/city, CompetitionUpdate, ResultUpsert, ResultCreate extra="ignore". repositories/base.py — delete_by(**filters). services/event_service.py переписан: list_with_counts, list_competitions (enrich: события + конкурсы + участники со именами спортсменов + результат из Result.medal + coach_id из organizer_id), create_event(organizer_id из токена), add/update/delete_competition, register/remove_participant (remove удаляет и результат), upsert_result/delete_result; явные session.commit() убраны (get_db коммитит сам). router.py: GET /events/competitions объявлен ДО /events/{event_id}; PATCH/DELETE /events/competitions/{competition_id}, POST/DELETE …/participants[/{athlete_id}], PUT/DELETE …/results/{athlete_id}, POST …/results (legacy). pytest 71/71.

**Frontend:** lib/api/events.functions.ts (CompetitionDto/*Child/Participant*, fetchCompetitions, create/update/delete/cancel, add/remove participant, set/clear result, isoDate/parseDate, payload location?: string). routes/competitions.tsx полностью на API: загрузка через fetchCompetitions, effectiveStatus (cancelled из статуса, past из end_date), поиск/фильтры, MiniStats, EventCard (edit/delete/cancel только для тренера), CompetitionFormModal, ManageAthletesModal (fetchAthletes({coachId}), toggle результатов для прошедших — клик по текущему результату снимает). tsc чист, vite build 3.74s. (Ошибки exports.functions.ts / schedules.tsx focus — предсуществующие, не трогаем.)

**Смоук (тренер):** superadmin создал шлейф region→center→coach (profiled f64fd8f9… — теперь у тренера есть профиль в coaches, нужен фильтрам спортсменов/соревнований) → тренер: спортсмен с coach_id → событие (level/city) → конкурс → участник POST → результат PUT ('1 place') → list показывает участника с результатом → удаление участника → удаление события → чистка спортсмена. Данные тестов убраны (events=0), справочный шлейф оставлен.

**Грабли:** запрос Invoke-RestMethod с null-param даёт «Method Not Allowed» (path ".../results/" матчит только POST /results); фильтры спортсменов по last_name = null при кириллице в pwsh-pipeline — сравнение делать латиницей.

**Roadmap:** строка «Соревнования» обновлена (перевод на API + фикс рендера).

---

## 2026-08-29 — Модуль «Расписание» переведён с моков на реальный API

**Backend (schedule periods):** models/schedule.py — новая SchedulePeriod (group_id FK CASCADE, coach_id FK SET NULL, center_id, period_start/end, status draft/active/archived + TimestampMixin) + Schedule.period_id FK CASCADE (Time-типы сохранены). Миграция ccddee0110ff (revises aabbccdd0101, применена к dev: alembic upgrade head). repositories/schedule_repo.py — SchedulePeriodRepository; schemas/schedule.py — SchedulePeriodCreate/Update/Response (enrich-поля: group_name, coach_name из User, coach_user_id, discipline, center_id, lesson_count, absences), ScheduleItemCreate/Update/Response, SchedulePeriodDetailResponse; legacy SaveScheduleResponse сохранены. services/schedule_service.py — create_period (coach/center из группы), list_periods (фильтры group_id/coach_user_id/center_id/status + enrich через IN + отпуска/больничные + lesson_count через count по period_id), get_period (с items), update/archive/approve/duplicate_period, create/update/delete_item; approve архивирует другие active-периоды группы; duplicate = +1 год к датам + копия занятий, статус draft; архивные периоды заблокированы для изменений (422). router.py: /schedules/periods* (GET/POST, GET/PATCH/DELETE /{id}, approve/duplicate, items CRUD) + legacy эндпоинты сохранены для тестов. dependencies.py: get_schedule_service(ScheduleRepository, SchedulePeriodRepository). pytest 71/71, ruff ok.

**Frontend:** lib/api/schedules.functions.ts (SchedulePeriodDto/item, fetch/create/update/archive/approve/duplicate период + item CRUD, isoDate/parsePeriodDate/addYears). routes/schedules.tsx без моков: карточки периодов с effectiveStatus (active с истёкшим period_end = archived), фильтры по группе/статусу, модалки создания периода (coach/admin), редактирования, формы занятия, confirm-диалоги; деталь по дням недели с бейджами отпуск/больничный из period.absences; загрузка detail перед показом; reloadGroups/реloadPeriods без useCurrentCoach (по user.id); CrossScheduleSummary — сводка недели из связки (item, period), isToday по недельной дате. tsc чист (исправлены parsePeriodDate double-export, focus() типизация), vite build 4.63s. (Ошибки exports.functions.ts — предсуществующие, не трогаем.)

**Смоук (тренер, coach@sokol.ru):** через API: период (enrich group/тренер/дисциплина/coach_user_id), занятие (день/время/зал), detail (items/absences), approve P1 → active; approve P2 → P1 архивирован; duplicate → draft +1 год, копия занятий (lesson_count=1); PATCH занятия в активном (19:00); PATCH после архивации → 422 (защита). Данные убраны (periods=0, smoke-группы удалены через SQL, т.к. DELETE = архивация by design). Бэкенд перезапущен (uvicorn --reload не подхватил новые файлы).

**Roadmap:** строка «Расписание» обновлена (перевод на API, миграция ccddee0110ff, смоук).

**Остались на моках:** Посещаемость (localStorage), Аналитика, Тренеры (справочник/отпуска), Профиль (localStorage), Комиссия (local-список). Планы фактически на API.

**Тесты расписания:** добавлен backend/tests/test_schedules_periods.py (2 теста): lifecycle периода (create+enrich → item → list по coach_user_id → detail → approve → approve второго архивирует первый → status-фильтры → duplicate архивированного (draft/+1 год/копия занятий) → PATCH item в копии → PATCH дат периода → невалидный диапазон 422 → DELETE-архивация → защита архива (PATCH/ADD/DELETE item, approve → 422) → удаление item в активном → 404) + require-auth 401. Итог: pytest 73/73 (было 71), ruff ok.

---

## 2026-08-29 - Модуль «Посещаемость» переведён с моков на реальный API

**Backend (attendance):** app/services/attendance_service.py переписан полностью: _existing_record/_upsert — повторный mark на (athlete_id, schedule_id, date) = update, первый = create, checked_by из токена, group_id из schedule; list (date/date_from/date_to/group_id/coach_user_id/center_id + пагинация, enrich athlete_name/rank/group_name/discipline/coach_name); journal занятий дня (active-периоды + legacy, day_of_week = weekday()+1, атлеты из GroupMember, status/record_id); batch_mark; delete; heatmap через list; QR сохранены. routes: POST /attendance/mark, /batch, PATCH/DELETE /{record_id}, GET / (фильтры), GET /journal (date, coach_user_id опц.), /stats, /stats/heatmap, /today, /qr/generate, /qr/scan. dependencies.py: get_attendance_service (AttendanceRepository + ScheduleRepository + SchedulePeriodRepository). Schemas: AttendanceMark (date обязателен), AttendanceBatch (records=AttendanceBatchRecord без date). pytest 76/76 (+tests/test_attendance.py: journal+upsert без дубля, batch+update+delete+404, require-auth 401), ruff ok.

**Frontend (frontend/src):** lib/api/attendance.functions.ts (AttendanceStatus, RecordDto, JournalItem, List, fetchAttendance(фильтры), fetchAttendanceJournal(date, coach_user_id?), markAttendance, batchAttendance, updateAttendance, deleteAttendanceRecord, isoDate/parseAttendanceDate/toApiDate). routes/attendance.tsx полностью без моков: журнал тренера (выбор даты, занятия дня = item-ы journal, спортсмены с текущими статусами и record_id, клик по статусу → mark или PATCH, локальное обновление массива, фильтр по coach_user_id=user.id только для тренера), навигатор по датам вынесен в отдельную полосу карточки — виден и когда занятий нет (раньше «Нет занятий в расписании» без возможности сменить дату!), статистика сайдбара (Присутствует/Отсутствует/Уважительная/Посещаемость), тепловая карта admin из /attendance (dateFrom/dateTo, фильтры Дисциплина/Тренер/Группа = уникальные значения из записей, режимы По группам/По тренерам, расчёт % по дням недели в браузере). tsc --noEmit чист по attendance (legacy exports.functions.ts не трогали), vite build OK.

**Смоук (живой, локально):** тренер coach@sokol.ru: шлейф через API (тренерский профиль и центр уже существовали — создавать не пришлось) → UI: логин тренером → /attendance → дата 01.09.2026 (вторник, day_of_week=2) → журнал SmokeGrp/1 спортсмен → клик ✓ create (record, checked_by=f64fd8f9-..., сайдбар 1/1, 100%) → клик ✗ = PATCH на тот же id, без дубля (total=1) → сайдбар 0/1, 0%; admin@sokol.ru → /attendance → тепловая карта: период по умолчанию 02.08–29.08 (запись 01.09 вне), расширил По=02.09 → строка SmokeGrp Judo ВТ=0%, фильтры подтянулись (Judo/Соколова Марина/SmokeGrp), режим «По тренерам» → Соколова Марина ВТ=0%. Консоль чистая (только a11y-issue). Данные очищены (attendance/schedule/member/group/athlete = 0).

**Грабли:** legacy POST /schedules требует center_id (пустой центр группы → 500); первый прогон создал лишние region/center — удалены; коуч-профиль тренера уже существовал (unique user_id) — переиспользован вместе с его центром. vite dev поднялся на 8082 (8080/8081 заняты).

**Roadmap:** строка «Посещаемость» обновлена (backend API + frontend без моков + pytest 76/76 + смоук).


## 2026-08-29 — Модуль «Аналитика» на реальном API

**Backend:** AnalyticsService.get_summary() + GET /analytics/summary (admin/director). KPI (спортсмены/тренеры/события не-cancelled/медали), athletes_by_status (русские лейблы), athletes_by_discipline, medal_dynamics за 12 месяцев (классификация из Result.medal gold/silver/bronze через Event.start_date), coach_workload (имя из User через Coach.user_id), top_athletes по очкам (3/2/1). pytest 78/78 (+test_analytics_summary.py).

**Frontend:** nalytics.functions.ts, 
outes/analytics.tsx без моков (KPI, пай-чарты, area, бар, топ-таблица, empty-state, загрузка/ошибка, заглушка не-админам). vite build + tsc OK (legacy-ошибки только exports.functions.ts).

**Смоук (admin):** KPI 3/1/1/2, «Активные 3», «Дзюдо 3», медаль в Июл по AreaChart, нагрузка «Соколова Марина», топ Ana 3 очка / Bob 2 очка. Данные созданы/очищены через API. Консоль без ошибок (только a11y). Uvicorn перезапущен с --reload (старый код без нового роутера давал 404).


### 2026-08-29 — Тренеры на реальном API

**Backend:** CoachService._enrich — имя «Фамилия Имя» из User, центр/город из Center, groups_count (Group.coach_id), athletes_count (Athlete.coach_id), vacations/sick_leaves isoformat. create/update переписаны: CoachVacation/CoachSickLeave вставляются/удаляются напрямую по coach_id (вместо lazy-relationship coach.vacations — ловил MissingGreenlet). pytest **81/81** (+test_coaches.py: RBAC coach GET=200 / coach POST+PATCH=403 / admin PATCH=200, create+enrich с отпуском/больничным/счётчиками, update vacations/is_active), ruff ok.

**Frontend:** coaches.functions.ts — CoachDto (name, center_name/city, groups_count, athletes_count, vacations, sick_leaves, biography) + createCoach/updateCoach + coachStatusTitle (Архив/Отпуск/На больничном/Активный). 
outes/coaches.tsx полностью без моков: таблица (ID, тренер+центр+стаж, специализация, группы/спортсмены, нагрузка % от max, статус), фильтр-чипы специализаций из данных, KPI, деталь-карточка с редактированием отпусков/больничных/is_active/категории/био, create-модалка скрыта для admin (только суперадмин: выбор пользователя из /users и центра из /organizations/centers). Экспорт Excel переведён на новые поля. Убраны нереализуемые в модели поля (email/phone/telegram/education/rating/efficiency).

**Смоук (admin на :8082):** список показывает реальные данные (Соколова Марина, ЦСЕ Смоук Москва, 6 лет стажа); деталь-модалка; отпуск 2026-08-20→09-10 + больничный → после reload бейдж «Отпуск», KPI активных 0; данные приведены к исходному (vacations=[], sick=[], is_active=true). Грабли: при первом сохранении через модалку отпуск не сохранился (данные ушли без vacations) — прямой PATCH подтвердил, что сервер и модалка корректны; первый UI-клик был с устаревшим HMR-состоянием. /users только superadmin — этим обусловлено скрытие кнопки «Добавить» для admin.

### 2026-08-29 - Модуль «Профиль» переведён с моков на реальный API

**Backend:** auth_service.get_me() расширен полем phone (user.phone) для /auth/me.

**Frontend:** auth.tsx - User.phone + mapUser считывает phone из MeResponse. routes/profile.tsx полностью на API: карточка тренера через findCoachByUserId(user.id) (имя/центр/город, специализация, квалификация, стаж из hire_date, biography, is_active, статус coachStatusTitle), отпуска/больничные читаются с бекенда readonly (редактирование - в модуле «Тренеры» у админа), контакты: email/phone (из /auth/me) + центр/трудоустроен, статистика groups_count/athletes_count/лет стажа, личные заметки остались в localStorage (sokol_coach_notes, бэкенд-таблицы нет). Отпуск/больничный карточки: бейдж «В отпуске/Работает/На больничном/Здоров» по активным периодам.

**Смоук:** admin - ветка «Тренерский профиль не заполнен» (у админа нет coach-записи), email/phone (+79000000001) реальные; тренер coach@sokol.ru - Соколова Марина, Дзюдо, Активный, ЦСЕ Смоук (Москва), 6 лет стажа, телефон +79000000002 из /auth/me, 0 групп/0 спортсменов, «Работает/Здоров»; заметка в localStorage под id тренера сохранена и удалена. Консоль без ошибок. tsc --noEmit чисто (кроме legacy exports), vite build OK.

### 2026-08-29 - Модуль «Отчёты» переведён с моков на реальный API

**Backend:**
- schemas/report.py: ReportResponse с UUID-полями (template_id/author_id/center_id/coach_id/reviewer_id), from_attributes, enrich-поля (template_name, coach_name, coach_user_id, author_name, center_name, center_city, sport), ReportUpdate.
- services/report_service.py: enrich (шаблон, тренер через Coach→User, автор, центр/город, спорт), create авто-подставляет coach_id/center_id из профиля автора (Coach по user_id), update/delete только draft (иначе 422), coach получает только свои отчёты (в роутере принудительный author_id=user.id, в get/update/delete 403 для чужих), _transition считает payout_tier (все числовые >= normFull → 50000, >= normBasic → 25000, иначе 0), refresh после update/_transition (fix MissingGreenlet from_attributes: updated_at onupdate=func.now() → expired в async).
- modules/reports/router.py: GET/PATCH/DELETE /{report_id} (после /templates!), list с query center_id/coach_user_id (coach → принудительно свои), POST /{report_id}/submit|approve|reject (approve/reject require admin/director, reject требует comment → 422).
- services/schedule_service.py: list_periods теперь включает items (id/day_of_week/start_time/end_time/room/location) в каждый snapshot — для расчёта недельных часов в форме отчёта.
- alembic ddeeff010203_seed_monthly_report_template.py (down_revision ccddee0110ff): сид шаблона «Основной отчёт тренера» (code monthly_coach_report, 5 полей: athletes_count/hours_per_week normFull/normBasic + special/sport/development_events с confirmationForm/unit), ON CONFLICT DO NOTHING; применён (GET /reports/templates отвечает).
- pytest 85/85 (test_reports_workflow: CRUD-черновик, нельзя редактировать submitted, coach 403 на чужой, list без чужих, submit считает payout_tier 50000/25000/0), ruff ok.

**Frontend:**
- lib/api/reports.functions.ts: ReportStatus/ReportFieldDto/ReportTemplateDto/ReportDto/ReportCreatePayload/ReportUpdatePayload + fetchReportTemplates/fetchReports/fetchReport/createReport/updateReport/deleteReport/submitReport/approveReport/rejectReport; generateReportDocx (DOCX base64) сохранён.
- routes/reports.tsx на API: список с Search + 5 статус-фильтров, даты ISO→dd.MM.yyyy, Word (имена групп через fetchGroups), модалка деталей (поля+нормы, review_comment, расчёт выплаты Приложение №6 через calculateGross/Ndf/Insurance из mock-data), approve/reject (с полем причины) для canReview = admin|director|superadmin (баг: superadmin не имеет роли admin — кнопки не показывались), draft-действия только у автора (isAuthor), «Редактировать» → /reports/new?reportId. Коуч видит свои (бэкенд сам фильтрует), admin/director — по centerId.
- routes/reports/new.tsx на API: validateSearch с опциональным reportId (тип search опциональный), при editReportId — fetchReport + загрузка в форму (update→submit), шаблон с реального бэкенда (fetchReportTemplates), автосчёт athletes_count (группы тренера coach_user_id → athlete_ids ∩ athletes active ≤21 лет) и hours_per_week (fetchSchedulePeriods с items минус absences, реплика calculateWeeklyHours), подсказки плана (fetchPlans год текущий, план approved/submitted, месяц по date или month, категории 3/4/5 → special/sport/development_events, «Заполнить из плана»); месяц — monthName из plans.functions (не date-fns format MMMM).
- TS-фиксы: PlanItem импортируется из mock-data (не экспортируется из plans.functions), сравнение месяца (month string vs number → date.getMonth()+1 либо monthNameRu), search необязательный у /reports/new.

**Смоук (тренер coach@sokol.ru на :8080):** создал отчёт (01.08-31.08.2026, Дзюдо, автозаполнения групп/часов нет — у тренера нет групп), указал athletes 32 / hours 10 / 3 мероприятия → Отправить (payout_tier=50000), Word-скачивание (DOCX base64), список: «1 ожидают проверки»; суперадмин (superadmin@sokol.ru/admin123 на :8081) → /reports, отчёт виден, Открыть → Утвердить → «Утверждён», «· Проверен: 29.08.2026», «1 утверждено»; кнопки approve/reject до фикса не показывались (superadmin ≠ admin) — добавлен canReview. Данные очищены (DELETE reports).
