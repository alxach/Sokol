# Tasks: Reports v2

## Задача 1: mock-data.ts — freshReportId + persist + load
- [ ] `freshReportId()`: макс id из массива `reports`, `RPT-${String(max+1).padStart(3,"0")}`
- [ ] `persistReports()`: `localStorage.setItem("sokol_reports", JSON.stringify(reports))`
- [ ] Загрузка: `const stored = typeof window !== "undefined" && localStorage.getItem("sokol_reports")` + парсинг + перезапись массива
- **Verify:** `npx tsc --noEmit --pretty` без ошибок в mock-data.ts

## Задача 2: ADR-017 — архитектура модуля отчётов
- [ ] `docs/decisions/ADR-017-reports-module.md`
- [ ] Статусная модель, поля, роли, persistence, планы на бэкенд
- **Verify:** файл создан, структура как в ADR-016

## Задача 3: reports/new.tsx — автоподстановка + сохранение
- [ ] Импорт `useAuth`, получение `user`
- [ ] Period start/end — `useState` с дефолтами (текущий месяц)
- [ ] Pre-fill: `user.coachName`, `user.coachDiscipline`, группа — из query params или первый из groups
- [ ] Кнопка «Сохранить черновик»: создать Report (status=draft, id=freshReportId()), push, persist, navigate(/reports)
- [ ] Кнопка «Отправить на проверку»: то же + status=submitted, submittedAt=сегодня
- **Verify:** созданный отчёт появляется на /reports

## Задача 4: reports.tsx — approve/reject/submit в модалке
- [ ] Кнопка [Утвердить]: `report.status = "approved"`, `reviewedAt`, `reviewerName` из `user`, persist, закрыть модалку
- [ ] Кнопка [Отклонить]: показать `<textarea>` для комментария, затем `status="rejected"`, reviewerComment, reviewedAt, reviewerName, persist
- [ ] Кнопка [Отправить на проверку] (для draft): `status = "submitted"`, `submittedAt`, persist
- **Verify:** статус меняется, localStorage хранит новое состояние, таблица обновляется

## Задача 5: Обновить roadmap.md
- [ ] В таблицу «Основные страницы» добавить/обновить строку «Отчёты» с ✅ и описанием
- **Verify:** roadmap читаем
