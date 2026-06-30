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
