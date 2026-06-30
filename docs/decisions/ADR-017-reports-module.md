# ADR-017: Модуль «Отчёты» (Reports)

## Status
Updated (2026-06-29)

## Date
2026-06-28

## Context

В системе «СОКОЛ» требуется модуль ежемесячной отчётности тренеров: тренер заполняет отчёт по шаблону, руководитель проверяет и утверждает.

На текущий момент:
- **Бэкенд** — модели `weekly_reports`, `report_comments`, `report_templates`, CRUD API
- **Фронтенд** — страницы `/reports` (список + модалка) и `/reports/new` (создание) на моках
- **coach-spec.md** — раздел 7 содержит описание
- **admin-spec.md** — раздел 9 содержит описание
- **spec-report-module.md** — спецификация модуля с моделями данных

Требования:
- Тренер создаёт ежемесячный отчёт по шаблону (5 полей)
- Тренер сохраняет черновик или отправляет на проверку
- Руководитель утверждает или отклоняет с комментарием
- Фильтрация и поиск по списку отчётов
- Все изменения сохраняются локально (localStorage) до подключения бэкенда

## Decision

### Модель данных

Согласована с `spec-report-module.md`:

```typescript
interface Report {
  id: string;                     // "RPT-001"
  templateId: string;             // FK → ReportTemplate
  coachId: string;                // FK → User
  coachName: string;
  coachInitials: string;
  sport: string;
  group: string;
  centerId: string;
  periodStart: string;            // "dd.MM.yyyy"
  periodEnd: string;              // "dd.MM.yyyy"
  data: Record<string, string | number>;  // key = field.key
  status: ReportStatus;
  reviewerComment?: string;
  reviewerName?: string;
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
}

type ReportStatus = "draft" | "submitted" | "approved" | "rejected";
```

### Шаблон отчёта

```typescript
interface ReportTemplate {
  id: string;
  name: string;
  code: string;
  type: "weekly" | "monthly";
  description: string;
  fields: ReportField[];
}

interface ReportField {
  key: string;
  label: string;
  type: "number" | "text" | "textarea";
  norm: string;
}
```

Текущий шаблон — `monthlyReportTemplate` (ежемесячный, 5 полей).

### Статусная модель

```
draft ──→ submitted ──→ approved
                └──→ rejected → draft (повторная отправка)
```

| Статус | Описание | Действия coach | Действия admin |
|--------|----------|---------------|----------------|
| `draft` | Черновик | Редактировать, отправить | — (не видит) |
| `submitted` | На проверке | Ожидание | Утвердить / Отклонить |
| `approved` | Утверждён | Просмотр | Просмотр |
| `rejected` | Отклонён | Просмотр + комментарий | Просмотр |

### Ролевая модель

| Роль | Действия |
|------|----------|
| **Coach** | Создание (pre-fill из профиля), сохранение черновика, отправка на проверку, просмотр своих отчётов |
| **Admin** | Просмотр отчётов своего центра, утверждение, отклонение с комментарием |
| **Director** | Просмотр отчётов всех центров, утверждение, отклонение с комментарием |

### UX тренера (создание)

**`/reports/new`:**
1. Шапка: заголовок «Основной отчёт тренера», кнопки [Сохранить черновик] / [Отправить на проверку]
2. Поля периода (с/по) — дефолт: текущий месяц
3. Вид спорта, ФИО тренера — pre-fill из `useAuth()`. **Группа** — auto-populate все группы тренера (фильтр `groups` по `coachId`), отображаются как `<Badge>`-список, сохраняются как `", ".join()` в поле `group`
4. 5 полей шаблона с нормами:
   - `athletes_count` (number) — кол-во занимающихся
   - `hours_per_week` (number) — кол-во часов
   - `special_events` (textarea) — мероприятия с особыми категориями
   - `sport_events` (textarea) — спортивные мероприятия
   - `development_events` (textarea) — мероприятия по развитию
5. Подпись тренера внизу

**Сохранение:**
- [Сохранить черновик] → `freshReportId()` → push в `reports` с `status: "draft"` → `persistReports()` → navigate(`/reports`)
- [Отправить на проверку] → то же с `status: "submitted"`, `submittedAt: format(new Date(), "dd.MM.yyyy")`

**Экспорт в Word:** группы резолвятся динамически на момент экспорта (`groups.filter` по `coachId`), а не из сохранённого поля `report.group`. Это гарантирует актуальный список групп даже для старых отчётов.

### UX admin (модалка)

**`ReportDetailModal`:**
1. Шапка: название, ФИО тренера, спорт, группа, бейдж статуса, [Скачать Word]
2. Период, даты отправки/проверки
3. 5 полей с нормами и оценкой комиссии
4. Комментарий проверяющего (если отклонён)
5. Подпись тренера
6. **Кнопки действий:**
   - `status === "submitted"` + admin: [Утвердить] / [Отклонить + textarea комментария]
   - `status === "draft"` + coach: [Редактировать] (/reports/new) / [Отправить на проверку]

### Persistence (mocks)

```typescript
export function freshReportId() {
  const max = reports.reduce((m, r) => Math.max(m, parseInt(r.id.replace("RPT-", ""), 10)), 0);
  return `RPT-${String(max + 1).padStart(3, "0")}`;
}

export function persistReports() {
  try { localStorage.setItem("sokol_reports", JSON.stringify(reports)); } catch {}
}
```

Загрузка при старте модуля (с SSR guard):
```typescript
try {
  if (typeof window !== "undefined") {
    const sr = localStorage.getItem("sokol_reports");
    if (sr) { const p = JSON.parse(sr); reports.length = 0; reports.push(...p); }
  }
} catch {}
```

### Word-документ (экспорт)

Структура сгенерированного `.docx` (соответствует `Месячный отчет тренера.pdf`):

**Page 1 (основной отчёт):**
- Заголовок: «ОСНОВНОЙ ОТЧЕТ ТРЕНЕРА» (жирный, 24pt, выравнивание по центру)
- Информационные поля (жирные, 14pt):
  - «Тренер (Ф.И.О.):`{fullName}`»
  - «Вид спорта:`{sportType}`»
  - «Группы:`{groups}`» (через запятую, из `groups.filter(gr ⇒ gr.coachId === user.id)`)
  - «Результаты работы за период:`{periodLabel}`»
- Таблица (4 колонки): № (5%) | Наименование показателя (42%) | Отчет о проделанной работе (26%) | Оценка комиссии (27%)
  - Шапка: шрифт 12pt, жирный, по центру, вертикальное выравнивание CENTER, границы со всех сторон
  - Строки: шрифт 11pt, выравнивание по левому краю, вертикальное выравнивание TOP
  - **Колонка «Отчет о проделанной работе» (3-я)**: содержит сырой текст из textarea формы (разбивка по `\n`), без парсинга. В конце — hint «В подробном отчете приложить фото, скрины, ссылки на публикации в СМИ, соц. сетях»
  - Ячейка «Оценка комиссии» (4-я колонка): «Выполнено / не выполнено» + указание подписи
  - Для row 1 (п. №1): дополнительный абзац «Приложить к отчету сканы журналов посещаемости»
- Пустая строка
- Строка подписи: `Тренер-преподаватель: _______________ {shortName}`
  - Ниже: `подпись ____________________________________`
  - Ниже: `ФИО: {fullName}`
- Выравнивание: последние 3 строки — по правому краю

**Pages 2+ (приложения):**
- Каждое приложение начинается с разрыва страницы (`pageBreakBefore`)
- Заголовок: «Приложение к Отчету тренера за {month} {year}г.» (жирный, 24pt)
- Пустая строка
- Подзаголовок: «Пункт №{3|4|5}: {label}» (жирный, 22pt)
- Пустая строка
- Описание события как plain text (дата, место, участники)

Шрифт: Times New Roman для всего документа.

### Доработки бэкенда

- `POST /api/v1/reports` — создание отчёта
- `GET /api/v1/reports` — список (с фильтрами: status, coach_id, period_start, period_end, center_id)
- `GET /api/v1/reports/{id}` — детали
- `PATCH /api/v1/reports/{id}/submit` — отправка на проверку (меняет статус на `submitted`)
- `PATCH /api/v1/reports/{id}/approve` — утверждение
- `PATCH /api/v1/reports/{id}/reject` — отклонение (тело: `{ comment: string }`)
- `GET /api/v1/reports/templates` — список шаблонов
- `POST /api/v1/reports/export/docx` — экспорт в Word

## Alternatives Considered

1. **Недельный + месячный шаблоны** — rejected на данном этапе. Хватает месячного.
2. **React-hook-form + zod** — избыточно для 5 полей. Пока простой `useState`.
3. **Автосохранение** — rejected. Тренеру нужен осознанный сабмит.
4. **Редактирование submitted-отчёта** — rejected. Отправленный отчёт lock, только approve/reject.

## Consequences

- ☐ `docs/decisions/ADR-017-reports-module.md` — создан
- ☐ `mock-data.ts`: добавлены `freshReportId()`, `persistReports()`, загрузка из localStorage
- ☐ `reports/new.tsx`: pre-fill из auth context, кнопки сохраняют в mock-data
- ☐ `reports.tsx`: approve/reject/submit handlers, комментарий при отклонении
- ☐ `roadmap.md`: страница Отчёты обновлена
- ☐ `reports/new.tsx` — группы тренера auto-populate по `coachId`, отображение через `<Badge>`, сохранение join-строкой
- ☐ `reports.tsx` — в `handleDownload` / `handleModalDownload` резолв групп **на момент экспорта** (фильтр `groups` по `coachId`), а не из сохранённого `report.group`. Word-документ всегда получает актуальный список групп тренера
- ☐ **Важно для бэкенда**: мок-данные `groups` используют сокращённые ФИО (`"Петров А.В."`), а `User.coachName` — полные (`"Петров Александр Владимирович"`). Привязка групп к тренеру через `coachId` (целочисленный FK). Бэкенд должен гарантировать консистентность `coachId` между `users` и `groups`
- ☐ `reports.functions.ts`: Word-документ переписан под точную структуру reference PDF — 4-колоночная таблица, «Оценка комиссии», подпись тренера, приложения (пункты №3-5) с page break
- ☐ `reports.functions.ts`: `formatEventRow` упрощён — парсинг даты/места/участников удалён. Колонка 3 содержит сырой текст тренера из textarea (split по `\n`) + hint про фото/скрины/СМИ
- ☐ **2026-06-29**: Исправлена навигация «Редактировать» → «К списку отчётов». Ранее `<Link to="/reports/new">` в `ReportDetailModal` не закрывал модалку (`selectedReport` оставался установлен), поэтому при возврате с `/reports/new` на `/reports` через кнопку «К списку отчётов» модалка снова открывалась. Исправлено: `<Link>` заменён на `Button` с вызовом `onClose()` перед `navigate({ to: "/reports/new" })`.
