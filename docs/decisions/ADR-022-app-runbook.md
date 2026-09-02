# ADR-022: Запуск приложения — RUNBOOK полного стека

## Status
Accepted

## Date
2026-08-27

## Context

Проект «СОКОЛ» — монорепо из трёх частей: `backend/` (FastAPI + PostgreSQL + Redis), `frontend/` (TanStack Start / Vite), `infra/` (Docker-стек: nginx, PostgreSQL, Redis, MinIO, бекенд, фронтенд). Полный стек разворачивается из `infra/` через Docker Compose в двух режимах — dev (с hot-reload через volumes) и prod-like (без volumes, multi-worker). Не было ни одного актуального документа с процедурой запуска.

Требуется зафиксировать воспроизводимую процедуру запуска полного стека (Windows/PowerShell — среда разработки на машине, где ведётся проект), чтобы не тратить время на диагностику при каждом старте.

## Decision

### 1. Подготовка .env

```powershell
cd C:\Proj\Sokol\infra
cp .env.example .env
# Отредактируйте .env: замените все `change-me-*` на реальные секреты
# Минимум для локального запуска:
#   POSTGRES_PASSWORD=localdbpass
#   REDIS_PASSWORD=localredispass
#   MINIO_ROOT_PASSWORD=localminiopass
#   JWT_SECRET_KEY=localjwtsecret
#   BACKEND_SECRET_KEY=localbackendsecret
```

### 2. Запуск (dev-режим с hot-reload через volumes)

```powershell
cd C:\Proj\Sokol\infra
docker compose -f docker-compose.yml up -d --build
```

Сервисы и порты (из `docker-compose.yml`):

| Сервис | Порт(ы) | Назначение |
|--------|---------|------------|
| nginx | 80, 443 | Reverse proxy, SSL termination, статика /media |
| frontend | 3000 | TanStack Start (прод-сборка в dev-контейнере) |
| backend | 8000 | FastAPI (volume `../backend:/app` — горячая перезагрузка кода) |
| db (PostgreSQL) | 5432 | БД |
| redis | 6379 | Кэш/сессии |
| minio | 9000, 9001 | S3-совместимое хранилище (API + консоль) |

- Бекенд и фронтенд монтируются как volumes — изменения в коде подхватываются без rebuild.
- Миграции **не** выполняются автоматически в этом режиме (нет entrypoint-скрипта). Выполните отдельно:
  ```powershell
  docker compose -f docker-compose.yml exec backend alembic upgrade head
  ```
- Seed учётных записей:
  ```powershell
  docker compose -f docker-compose.yml exec backend python -m seed_data
  ```

### 3. Запуск (prod-like — без volumes, multi-worker)

```powershell
cd C:\Proj\Sokol\infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Различия с dev-режимом (`docker-compose.prod.yml`):
- `backend`: `target: runner` (многостадийная сборка, нет volumes), команда `alembic upgrade head && uvicorn ... --workers 4`
- `frontend`: `target: runner` (прод-сборка Nitro, нет volumes), `NODE_ENV=production`
- Порт фронтенда наружу — **3000** (nginx проксирует 80/443 → frontend:3000, backend:8000)

### 4. Учётные записи

Тестовые учётные записи (пароль у всех **`admin123`**), создаются скриптом `seed_data.py`:

| Роль | Email |
|------|-------|
| Суперадмин | `superadmin@sokol.ru` |
| Руководитель всех центров (director) | `director@sokol.ru` |
| Руководитель центра (admin) | `admin@sokol.ru` |
| Тренер (coach) | `coach@sokol.ru` |

### 5. Верификация полного стека

1. `Test-NetConnection localhost -Port 80,443,3000,8000,5432,6379,9000,9001`
2. Откройте `http://localhost` (nginx) — должен открыться фронтенд через nginx.
3. Логин под `admin@sokol.ru` / `admin123`.
4. MinIO Console: `http://localhost:9001` (логин/пароль из `MINIO_ROOT_USER/PASSWORD`).
5. Swagger бекенда: `http://localhost:8000/docs` (прямой доступ к бекенду минуя nginx).

### 6. Остановка и очистка

```powershell
# Остановка с сохранением данных (volumes)
docker compose -f docker-compose.yml down

# Полная очистка с удалением volumes (БД, Redis, MinIO)
docker compose -f docker-compose.yml down -v
```

### 7. Prod-путь (для справки — продакшн-окружение)

То же, что §3, но на целевом сервере с реальными секретами, настроенным SSL в `infra/docker/nginx/sites/`, и без `volumes` в override-файле. Entrypoint бекенда сам выполняет `alembic upgrade head`, затем `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4`.

## Consequences

1. Запуск полного стека сводится к подготовке `.env` и команде `docker compose -f docker-compose.yml up -d --build` из `infra/`; миграции и seed — отдельными `exec`-командами (§2).
2. Для prod-like окружения используется override `docker-compose.prod.yml` (§3); продакшн — тот же стек на целевом сервере (§7).
3. Информация о dev-режиме (ручной запуск backend/frontend вне Docker) в этом документе не фиксируется — разворачивание идёт контейнеризированным стеком.