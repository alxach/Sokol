# Spec: Модуль отчётов — доведение до ума (v2)

## Objective
Замкнуть все незавершённые сценарии в модуле `/reports`: сохранение отчётов, отправка на проверку, утверждение/отклонение, автоподстановка данных тренера.

**Пользователи:** Coach (создаёт/отправляет), Admin/Director (проверяет/утверждает)

**Критерии успеха:**
- Coach создаёт отчёт → сохраняет черновик → отправляет на проверку
- Admin видит отправленные отчёты → утверждает или отклоняет с комментарием
- Все изменения сохраняются в localStorage (как в competitions/attendance)
- Данные тренера, дисциплины, группы подставляются из контекста авторизации

## Tech Stack
- React 19 / TanStack Start / TypeScript
- Tailwind CSS v4 / shadcn-ui
- localStorage persistence

## Commands
```
Build:    cd frontend && npx tsc --noEmit --pretty
Dev:      cd frontend && npm run dev
```

## Project Structure
```
frontend/src/
├── routes/
│   ├── reports.tsx          # список + модалка (правим approve/reject/submit)
│   └── reports/
│       └── new.tsx           # форма создания (правим persistence + auth)
├── lib/
│   └── mock-data.ts          # правим: freshReportId, persistReports, localStorage
docs/
└── decisions/
    └── ADR-017-reports-module.md  # новый ADR
```

## Code Style
- Импорты: React → библиотеки → @/components → @/lib → локальные
- Форматирование: как в остальных файлах
- Мок-функции: `freshReportId()` (без счётчика, max id), `persistReports()`
- localStorage: `typeof window !== "undefined"` guard

## Boundaries
- **Always:** Сохранять в localStorage после каждого изменения, SSR guard
- **Ask first:** Изменение схемы Report, новый тип отчёта
- **Never:** Удалять mock-данные без замены на API, хардкод тренера

## Success Criteria
- [ ] `freshReportId()` и `persistReports()` в mock-data.ts
- [ ] `/reports/new`: форма pre-fill из user (coachName, coachDiscipline)
- [ ] `/reports/new`: кнопка «Сохранить черновик» → push + persist
- [ ] `/reports/new`: кнопка «Отправить на проверку» → push + status=submitted
- [ ] Модалка: кнопки [Утвердить] и [Отклонить] меняют статус
- [ ] Модалка: при отклонении — поле для комментария
- [ ] Модалка: кнопка [Отправить на проверку] для draft
- [ ] ADR-017 создан
- [ ] tsc — no errors

## Open Questions
1. Нужна ли кнопка «Редактировать» для draft — пока редирект на `/reports/new` без pre-fill
