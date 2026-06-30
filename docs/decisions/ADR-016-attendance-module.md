# ADR-016: Модуль «Посещаемость» (Attendance)

## Status
Draft

## Date
2026-06-28

## Context

В системе «СОКОЛ» требуется модуль учёта посещаемости: тренер отмечает присутствие спортсменов на занятиях, руководитель видит тепловую карту посещаемости по дням недели.

На текущий момент:
- **Бэкенд** — модели `attendance`, `attendance_qr_codes`, CRUD API (`/attendance`, `/attendance/batch`, `/attendance/stats/heatmap`, `/attendance/qr/generate`, `/attendance/qr/scan`)
- **Фронтенд** — страница `/attendance` на моках: журнал для тренера (отметки на сегодня) + тепловая карта для admin (на случайных данных)
- **coach-spec.md** — раздел 5 содержит базовое описание
- **admin-spec.md** — раздел 7 содержит базовое описание

Требования:
- Тренер выбирает занятие из расписания → видит список спортсменов группы
- Тренер проставляет статус: присутствует / отсутствует / уважительная причина
- Тренер может просматривать и редактировать посещаемость за любой день (навигация по датам)
- Руководитель видит тепловую карту посещаемости по дням недели (с фильтрами)
- Расчёт % посещаемости на основе реальных данных, не random
- Подготовка к бэкенду: все операции через сервисные функции, которые позже заменятся на fetch

## Decision

### Модель данных

Согласована с `schema-spec.md` и ERD:

```typescript
interface AttendanceRecord {
  id: string;             // "AT-001"
  scheduleId: string;     // FK → Schedule
  date: string;           // "dd.MM.yyyy"
  athleteId: string;      // FK → Athlete
  athleteName: string;
  status: AttendanceStatus;
  markedByCoachId: string;
}

type AttendanceStatus = "present" | "absent" | "excused";
```

### Ролевая модель

| Роль | Действия |
|------|----------|
| **Coach** | Отметка посещаемости своих групп, редактирование отметок, просмотр истории |
| **Admin** | Просмотр тепловой карты своего центра, фильтрация, без редактирования |
| **Director** | Просмотр тепловой карты по всем центрам, без редактирования |

### UX тренера (Coach Journal)

**Элементы:**
1. **Date navigator** — блок над таблицей: ← [15 июня 2026, Пн] → (стрелки по дням + Popover + Calendar для выбора даты)
2. **Сайдбар слева** — список занятий тренера из расписания, отфильтрованный по дню недели (показываются только занятия на выбранную дату). Для каждого показано количество отметок. Цветовая индикация левой границы карточки: 🟢 зелёная (все спортсмены отмечены), 🟡 жёлтая (отмечены частично), без цвета (нет отметок)
3. **Таблица спортсменов** — №, ФИО (с аватаром), разряд, текущий статус, 3 кнопки: Присутствует / Отсутствует / Уважительная
4. **Блок статистики** — количество по статусам + % посещаемости
5. **Кнопка «Сохранить»** — появляется при изменении статусов (dirty state)

**Сохранение (upsert):**
- При сохранении ищет существующую запись по `scheduleId + athleteId + date`
- Если найдена — обновляет `status`
- Если не найдена — создаёт новую с `freshAttendanceId()`
- После сохранения — `persistAttendanceRecords()` в localStorage
- При переключении даты без сохранения — сброс overrides

### UX admin (Heatmap)

**Элементы:**
1. **Переключатель вида:** «По группам» / «По тренерам»
2. **Фильтры:** период (с/по, текстовый Input), дисциплина (select), тренер (select), группа (select)
3. **Легенда:** цветовые зоны посещаемости: ≥90% / 75-89% / 60-74% / 40-59% / <40%
4. **Таблица:** строка = группа/тренер, 7 колонок = дни недели (Пн–Вс), ячейка = % посещаемости

**Расчёт:**
- Процент = `present / (present + absent + excused)` по всем записям за выбранный период для отфильтрованных расписаний
- «Нет данных» если нет ни одной записи

### Persistence (mocks)

```typescript
let attendanceIdCounter = 8;
export function freshAttendanceId() {
  return `AT-${String(++attendanceIdCounter).padStart(3, "0")}`;
}

export function persistAttendanceRecords() {
  try { localStorage.setItem("sokol_attendance", JSON.stringify(attendanceRecords)); } catch {}
}
```

Загрузка при старте модуля (с SSR guard):

```typescript
try {
  if (typeof window !== "undefined") {
    const a = localStorage.getItem("sokol_attendance");
    if (a) { const p = JSON.parse(a); attendanceRecords.length = 0; attendanceRecords.push(...p); }
  }
} catch {}
```

### Хранение id counter

Счётчик `attendanceIdCounter` хранится в модульной переменной, инициализируется числом записей в массиве при загрузке (чтобы не пересекаться с уже существующими ID из localStorage).

### Доработки бэкенда

- `POST /attendance/batch` — массовая отметка группы (принимает массив `{ athlete_id, status }` + `schedule_id` + `date`)
- `PATCH /attendance/{id}` — исправление отметки
- `GET /attendance/stats/heatmap` — тепловая карта (параметры: `date_from`, `date_to`, `discipline`, `coach_id`, `group_id`)
- Уникальность: одна запись на `athlete_id + schedule_id + date` (unique constraint)
- `marked_by_coach_id` — из JWT текущего тренера
- При удалении расписания (Schedule) — каскадное удаление связанных записей

## Alternatives Considered

1. **Автосохранение при клике** (без кнопки «Сохранить») — rejected. Тренеру нужен буфер: отметить нескольких спортсменов → сохранить разом.
2. **React-hook-form + zod** — избыточно для простого on/off UI.
3. **Heatmap на Chart (Recharts)** — rejected. Таблица с цветными ячейками нагляднее для понедельного просмотра, не требует загрузки библиотеки графиков.
4. **Date picker вместо текстовых полей для admin** — отложено. На бэкенде будет `date_from`/`date_to` как query params, пока текстовый Input достаточен.

## Consequences

- ☐ `docs/decisions/ADR-016-attendance-module.md` — создан
- ☐ `mock-data.ts`: добавлены `freshAttendanceId()`, `persistAttendanceRecords()`, загрузка из localStorage
- ☐ `attendance.tsx`: date navigator (← → + Popover Calendar), real save/upsert, heatmap из attendanceRecords, удалён `generateHeatmapData`, цветовая индикация отметок в сайдбаре (зелёный/жёлтый), фильтрация расписания по дню недели
- ☐ `roadmap.md`: страница Посещаемость обновлена
- ☐ `coach-spec.md`: уточнён раздел 5 (навигация по датам)
- ☐ `admin-spec.md`: уточнён раздел 7 (источник данных heatmap)
