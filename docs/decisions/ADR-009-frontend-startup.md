# ADR-009: Запуск frontend-приложения

## Status
Accepted

## Date
2026-06-21

## Context

Frontend-приложение «СОКОЛ» построено на TanStack Start (Vite). Требуется зафиксировать процедуру запуска для разработки, чтобы каждый раз не тратить время на диагностику.

На текущий момент:
- Frontend работает полностью на мок-данных (`mock-data.ts`), не требует бэкенда
- Используется Vite dev-сервер на порту 8080
- Frontend расположен в директории `frontend/`

## Decision

### Команда запуска

```powershell
cd C:\Proj\Sokol\frontend
npm run dev
```

Сервер стартует на `http://localhost:8080`

### Тестовые учётные записи

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | admin@sokol.ru | любой |
| Coach | coach@sokol.ru | любой |
| Director | director@sokol.ru | любой |

### Фоновый запуск (Windows)

Если нужно запустить в фоне (не занимая терминал):

```powershell
Start-Process -WorkingDirectory "C:\Proj\Sokol\frontend" -NoNewWindow -FilePath "pwsh.exe" -ArgumentList "-NoProfile -Command `"npm run dev`""
```

Логи будут в терминале запуска.

### Зависимости

- Node.js (любая современная версия, LTS)
- Установленные зависимости: `npm install` (выполнено, `node_modules/` существует)

### Ограничения

- Бэкенд для запуска не требуется — все данные из моков
- Для интеграции с реальным API потребуется переключение `mock-data.ts` на TanStack Query

## Consequences

1. Разработчик запускает одной командой `npm run dev` из `frontend/`
2. Hot-reload работает через Vite HMR
3. Нет зависимости от Docker/бэкенда для UI-разработки
