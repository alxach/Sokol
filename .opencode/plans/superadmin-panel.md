# План: Superadmin Panel + Real Auth + Seed Data

## Контекст
- Frontend полностью mock (localStorage, hardcoded пользователи)
- Backend JWT auth работает, но нет CRUD для управления пользователями
- БД пустая (32 таблицы, 0 строк)
- Нет `center_id` в таблице users

## Фаза 1: Backend — Миграция + User CRUD

### 1.1 Миграция: `center_id` в users
- Новый файл: `backend/alembic/versions/d3e4f5a6b7c8_add_center_id_to_users.py`
- `alembic upgrade head`

### 1.2 Расширить UserRepository
- `list_all(page, per_page, search, role, is_active)` — пагинация + поиск
- `update(user_id, **fields)` — обновление полей
- `set_roles(user_id, role_codes)` — замена ролей
- `soft_delete(user_id)` — деактивация

### 1.3 User Management Schemas
- `UserListResponse`, `UserCreateRequest`, `UserUpdateRequest`, `UserAssignRolesRequest`
- Файлы: `backend/app/schemas/user_admin.py`

### 1.4 User Management Router
- Файл: `backend/app/modules/users_admin/router.py`
- Префикс: `/users`, dependencies: `require_roles("superadmin")`
- Эндпоинты:
  - `GET /users` — список с пагинацией, поиском, фильтрами
  - `POST /users` — создание (email, phone, password, ФИО, роль, центр)
  - `GET /users/{id}` — детали пользователя
  - `PUT /users/{id}` — редактирование
  - `POST /users/{id}/roles` — назначение ролей
  - `DELETE /users/{id}` — деактивация (soft delete)
  - `GET /users/roles` — список всех ролей (для дропдауна)

### 1.5 Подключить роутер
- `backend/app/api/v1/__init__.py` — добавить users_admin router

## Фаза 2: Backend — Seed Data

### 2.1 Скрипт.seed_data.py
- Регионы: Москва, Санкт-Петербург, Краснодарский край
- Центры: 3-4 центра (по одному в регионе)
- Пользователи:
  - `superadmin@sokol.ru` / `admin123` — роль superadmin
  - `director@sokol.ru` / `admin123` — роль director
  - `admin@sokol.ru` / `admin123` — роль admin, центр "ЦСЕ Южный"
  - `coach@sokol.ru` / `admin123` — роль coach, центр "ЦСЕ Южный"
- Запуск: `python -m backend.seed_data` или через API endpoint

## Фаза 3: Frontend — Реальная Авторизация

### 3.1 API клиент
- Файл: `frontend/src/lib/api/client.ts`
- `apiFetch(path, options)` — обёртка над fetch с JWT токеном из localStorage
- Автоматический refresh при 401

### 3.2 Замена auth.tsx
- Убрать MOCK_USERS и localStorage-логику
- `login()` → POST `/api/v1/auth/login` → сохранить токен + user
- `logout()` → очистить токен
- `useAuth()` → декодировать JWT или вызвать `/api/v1/auth/me`
- Добавить `isSuperadmin` computed

### 3.3 Обновить login.tsx
- Подключить реальный API вместо mock

## Фаза 4: Frontend — Admin Pages

### 4.1 Страница Users (`/admin/users`)
- Файл: `frontend/src/routes/admin/users.tsx`
- Таблица: ФИО, email, телефон, роль, центр, статус, дата создания
- Поиск по ФИО/email
- Фильтр по роли, статусу, центру
- Кнопка "Создать пользователя" → модалка
- Редактирование → модалка (клик по строке)
- Roles badge (colored)

### 4.2 Модалка создания/редактирования
- Форма: ФИО, email, телефон, пароль (только при создании), роль (select), центр (select)
- Валидация на клиенте

### 4.3 Страница Audit (`/admin/audit`)
- Файл: `frontend/src/routes/admin/audit.tsx`
- Таблица: дата, пользователь (ФИО), действие, объект, IP
- Фильтры: по дате (range), пользователю, типу действия
- Пагинация

### 4.4 Sidebar обновление
- Добавить группу "Управление" (только для superadmin):
  - Пользователи → `/admin/users`
  - Аудит-лог → `/admin/audit`

## Файлы для создания/изменения

### Backend (создание):
- `backend/alembic/versions/d3e4f5a6b7c8_add_center_id_to_users.py`
- `backend/app/schemas/user_admin.py`
- `backend/app/modules/users_admin/__init__.py`
- `backend/app/modules/users_admin/router.py`
- `backend/seed_data.py`

### Backend (изменение):
- `backend/app/models/user.py` — добавить center_id FK
- `backend/app/repositories/user_repo.py` — расширить методы
- `backend/app/api/v1/__init__.py` — подключить users_admin

### Frontend (создание):
- `frontend/src/lib/api/client.ts`
- `frontend/src/routes/admin/users.tsx`
- `frontend/src/routes/admin/audit.tsx`
- `frontend/src/components/user-modal.tsx`

### Frontend (изменение):
- `frontend/src/lib/auth.tsx` — замена mock на JWT
- `frontend/src/routes/login.tsx` — подключение к API
- `frontend/src/components/app-sidebar.tsx` — admin секция
- `frontend/src/routeTree.gen.ts` — auto-regen

## Порядок выполнения
1. Backend миграция (center_id)
2. Backend UserRepository + schemas + router
3. Seed data скрипт + запуск
4. Frontend API клиент
5. Frontend auth (заменить mock)
6. Frontend admin pages (users + audit)
7. Sidebar обновление
8. Тестирование: логин superadmin → создание пользователя → проверка
