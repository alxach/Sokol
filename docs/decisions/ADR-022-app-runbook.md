# ADR-022: Запуск приложения — RUNBOOK локальной разработки

## Status
Accepted

## Date
2026-08-27

## Context

Проект «СОКОЛ» — монорепо из трёх частей: `backend/` (FastAPI + PostgreSQL + Redis), `frontend/` (TanStack Start / Vite), `infra/` (Docker-стек, nginx, продакшн). Не было ни одного актуального документа с процедурой запуска:

- Единственный инструктивный ADR — **ADR-009 устарел**: он описывал эпоху мок-данных и порт/URL, которые не совпадают с текущей реальностью.
- Есть два разных docker-compose (`backend/docker-compose.dev.yml` для dev-инфраструктуры и `infra/docker-compose.yml` + `.prod.yml` для полного стека), несколько скриптов seed (`seed.py`, `seed_data.py`) — без пояснения, какой когда использовать.
- Цепочка миграций Alembic расширилась до 8 ревизий (head `d3e4f5a6b7c8`) — нигде не зафиксирована.
- Backend-конфиг читает `.env` из `backend/`, frontend жёстко связан с `http://localhost:8000/api/v1` (`src/lib/api/client.ts`), dev-сервер фронтенда жёстко слушает **порт 8080** (`@lovable.dev/vite-tanstack-config`, strictPort).

Требуется зафиксировать воспроизводимую процедуру запуска для локальной разработки (Windows/PowerShell — среда разработки на машине, где ведётся проект), чтобы не тратить время на диагностику при каждом старте.

## Decision

### 1. Состав и порты

| Компонент | Технология | Порт | Откуда запускается |
|-----------|------------|------|---------------------|
| PostgreSQL 16 | Docker `postgres:16-alpine` | 5432 | `backend/docker-compose.dev.yml` |
| Redis 7 | Docker `redis:7-alpine` | 6379 | `backend/docker-compose.dev.yml` |
| Backend | FastAPI + uvicorn | 8000 | venv `backend/.venv_backend` |
| Frontend | TanStack Start (Vite) | 8080 | npm из `frontend/` |

Frontend dev-сервер ходит в API по жёсткому адресу `http://localhost:8000/api/v1` (`frontend/src/lib/api/client.ts`). Изменять этот адрес через VITE_ нельзя — бейз захардкожен.

### 2. Инфраструктура (DB + Redis)

```powershell
cd C:\Proj\Sokol\backend
docker compose -f docker-compose.dev.yml up -d
```

- Креды контейнеров: `sokol` / `sokol`, БД `sokol`.
- Healthcheck — `pg_isready` / `redis-cli ping`, контейнеры `backend-db-1` и `backend-redis-1`.
- Миграции/seed идут **снаружи** контейнеров (через venv), в отличие от prod-пути, где всё делает entrypoint внутри контейнера.

### 3. Миграции

Цепочка из 8 ревизий, head — **`d3e4f5a6b7c8`** (`add center_id to users`):

```
<base> → af1fc816173d (init users and audit)
      → aff04e922116 (add all modules)
      → 07dfca3a3f88 (add vacation_start_end to coaches)
      → 69889c273334 (add coach_vacations)
      → aa4b60334ee5 (add incentive program, commission protocol, event plan)
      → b1c2d3e4f5a6 (add constraints: UNIQUE, ON DELETE, CHECK)
      → c7d8e9f0a1b2 → d3e4f5a6b7c8 (head)
```

```powershell
cd C:\Proj\Sokol\backend
.\.venv_backend\Scripts\alembic.exe upgrade head
```

Статус: `alembic current` (должен показать `d3e4f5a6b7c8 (head)`).

### 4. Seed — учётные записи

Рекомендуется **`seed_data.py`** (идемпотентный, добавляет регионы/центры/пользователей с ролями). Легаси `seed.py` — только роли и 2 пользователя, использовать не требуется.

```powershell
cd C:\Proj\Sokol\backend
.\.venv_backend\Scripts\python.exe -m seed_data
```

Тестовые учётные записи (пароль у всех **`admin123`**):

| Роль | Email |
|------|-------|
| Суперадмин | `superadmin@sokol.ru` |
| Руководитель всех центров (director) | `director@sokol.ru` |
| Руководитель центра (admin), ЦСЕ Южный | `admin@sokol.ru` |
| Тренер (coach), ЦСЕ Южный | `coach@sokol.ru` |

Роли/права также досеиваются автоматически при старте бекенда (lifespan в `backend/app/main.py`).

### 5. Backend

```powershell
cd C:\Proj\Sokol\backend
.\.venv_backend\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Конфигурация читается из `backend/.env` (`DEBUG=true`, дефолтный JWT-секрет допустим только при `DEBUG=true` — fail-fast в `backend/app/config.py`).
- Swagger: `http://localhost:8000/docs`. Health-проверка: `GET http://localhost:8000/api/v1/health` (если эндпоинт существует).
- venv-интерпретатор **Python 3.14.5** (`backend/.venv_backend`), Python >= 3.12 (`pyproject.toml`).

### 6. Frontend

```powershell
cd C:\Proj\Sokol\frontend
npm run dev
```

- Сервер слушает **`http://localhost:8080`** (strictPort задан в `@lovable.dev/vite-tanstack-config`; ADR-009 с портом из эпохи моков — устарел).
- Зависимости уже установлены (`node_modules/`); при чистом клоне — `npm install` / `npm ci`.
- Линтинг: `npm run lint`; сборка: `npm run build` (прод-биндинг через Nitro).

### 7. Верификация запуска

1. `Test-NetConnection localhost -Port 5432,6379,8000,8080` — все четыре порта отвечают.
2. Логин на `http://localhost:8080` под `admin@sokol.ru` / `admin123`.
3. Дашборд отдаёт реальные данные (не моки) — выступает индикатором живой связки frontend ↔ backend ↔ БД.

### 8. Prod-путь (для справки)

Полный стек (nginx на 80/443, MinIO, бекенд/фронтенд в контейнерах) собирается из `infra/`:

```powershell
cd C:\Proj\Sokol\infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Entrypoint бекенда сам выполняет `alembic upgrade head`, затем `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4`. Локальная разработка этот путь **не требует** — достаточно шагов 2–6.

## Consequences

1. Запуск разработчика сводится к трём командам: Docker (шаг 2), uvicorn (шаг 5), `npm run dev` (шаг 6) — миграции и seed только при новом клоне/смене схемы.
2. Устранено противоречие с ADR-009: зафиксированы актуальные порты (8000/8080) и факт работы фронтенда с реальным API.
3. Зафиксирована цепочка миграций и head-ревизия — снижен риск рассинхрона схем.
4. Негативное: порт 8080 и API-бейз `localhost:8000` захардкожены во фронтенде и конфиге lovable — перенос на другой порт/домен потребует правки кода, а не env-переменной.