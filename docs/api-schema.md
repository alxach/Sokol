# API Schema «СОКОЛ»

> Версия 1.0 | FastAPI | Дата: 2026-05-29

---

## Содержание

1. [Соглашения](#1-соглашения)
2. [Авторизация](#2-авторизация)
3. [Пользователи и роли](#3-пользователи-и-роли)
4. [Организации и филиалы](#4-организации-и-филиалы)
5. [Тренеры](#5-тренеры)
6. [Спортсмены](#6-спортсмены)
7. [Группы и расписание](#7-группы-и-расписание)
8. [Посещаемость](#8-посещаемость)
9. [Отчёты](#9-отчёты)
10. [Мероприятия и турниры](#10-мероприятия-и-турниры)
11. [Документы](#11-документы)
12. [Аналитика и BI](#12-аналитика-и-bi)
13. [Уведомления](#13-уведомления)
14. [Аудит](#14-аудит)

---

## 1. Соглашения

### 1.1 Base URL

```
/api/v1
```

### 1.2 Формат ответа

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 100
  },
  "error": null
}
```

### 1.3 Формат ошибки

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### 1.4 Пагинация

| Параметр | Тип | Default | Описание |
|----------|-----|---------|----------|
| `page` | int | 1 | Номер страницы |
| `per_page` | int | 50 | Записей на странице (max 200) |

### 1.5 Сортировка и фильтрация

```
GET /resource?sort=-created_at&filter[status]=active&q=поиск
```

- `sort=-field` — сортировка по убыванию
- `sort=field` — сортировка по возрастанию
- `filter[field]=value` — фильтр по точному значению
- `q` — полнотекстовый поиск

### 1.6 HTTP Status Codes

| Код | Описание |
|-----|----------|
| 200 | Успех |
| 201 | Создано |
| 204 | Нет содержимого (удаление) |
| 400 | Ошибка валидации |
| 401 | Не авторизован |
| 403 | Нет прав доступа |
| 404 | Не найдено |
| 409 | Конфликт (дубликат) |
| 422 | Ошибка бизнес-логики |
| 500 | Внутренняя ошибка |

### 1.7 Авторизация

```
Authorization: Bearer <access_token>
```

- Access token: JWT, expires 30 min
- Refresh token: JWT, expires 7 days
- Токен передаётся в заголовке `Authorization: Bearer <token>`

---

## 2. Авторизация

### 2.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| POST | `/auth/login` | Вход по email + пароль | Публичный |
| POST | `/auth/register` | Саморегистрация | Публичный |
| POST | `/auth/refresh` | Обновление токенов | Refresh token |
| POST | `/auth/logout` | Выход (инвалидация refresh) | Authenticated |
| POST | `/auth/forgot-password` | Запрос сброса пароля | Публичный |
| POST | `/auth/reset-password` | Сброс пароля по токену | Token |
| GET | `/auth/me` | Текущий пользователь | Authenticated |
| PATCH | `/auth/me` | Обновить свой профиль | Authenticated |
| POST | `/auth/invite` | Отправить приглашение | superadmin, admin |

### 2.2 POST `/auth/login`

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "Bearer",
  "expires_in": 1800,
  "user": {
    "id": "uuid",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "roles": ["coach"],
    "center_id": "uuid | null"
  }
}
```

### 2.3 POST `/auth/register`

**Request:**
```json
{
  "email": "string",
  "phone": "string",
  "password": "string",
  "first_name": "string",
  "last_name": "string",
  "middle_name": "string | null",
  "invite_token": "string | null"
}
```

### 2.4 POST `/auth/invite`

**Request:**
```json
{
  "email": "string",
  "role_code": "coach",
  "center_id": "uuid"
}
```

---

## 3. Пользователи и роли

### 3.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/users` | Список пользователей | superadmin, admin |
| GET | `/users/{id}` | Детально | superadmin, admin |
| PATCH | `/users/{id}` | Редактировать | superadmin, admin |
| DELETE | `/users/{id}` | Удалить (soft) | superadmin |
| GET | `/roles` | Список ролей | superadmin, admin |
| POST | `/roles` | Создать роль | superadmin |
| PATCH | `/roles/{code}` | Редактировать роль | superadmin |
| DELETE | `/roles/{code}` | Удалить роль | superadmin |
| GET | `/users/{id}/roles` | Роли пользователя | superadmin, admin |
| POST | `/users/{id}/roles` | Назначить роль | superadmin, admin |
| DELETE | `/users/{id}/roles/{role}` | Отозвать роль | superadmin |

---

## 4. Организации и филиалы

### 4.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/regions` | Список регионов | Все |
| POST | `/regions` | Создать регион | superadmin |
| GET | `/centers` | Список филиалов | superadmin, director, admin |
| POST | `/centers` | Создать филиал | superadmin, director |
| GET | `/centers/{id}` | Детально | superadmin, director, admin* |
| PATCH | `/centers/{id}` | Редактировать | superadmin, director, admin* |
| DELETE | `/centers/{id}` | Удалить | superadmin |

> \* — только свой центр

---

## 5. Тренеры

### 5.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/coaches` | Список тренеров | superadmin, director, admin |
| POST | `/coaches` | Создать (привязать user) | superadmin, director, admin |
| GET | `/coaches/{id}` | Детально | superadmin, director, admin, coach |
| PATCH | `/coaches/{id}` | Редактировать | superadmin, director, admin |
| DELETE | `/coaches/{id}` | Уволить (soft) | superadmin, director, admin |
| GET | `/coaches/{id}/stats` | Статистика тренера | superadmin, director, admin |
| PATCH | `/coaches/{id}/profile` | Редактировать профиль | coach (только свой) |

---

## 6. Спортсмены

### 6.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/athletes` | Список спортсменов | superadmin, director, admin, coach* |
| POST | `/athletes` | Создать | superadmin, director, admin, coach |
| GET | `/athletes/{id}` | Детально | superadmin, director, admin, coach* |
| PATCH | `/athletes/{id}` | Редактировать | superadmin, director, admin, coach* |
| DELETE | `/athletes/{id}` | Удалить (soft) | superadmin, director, admin |
| GET | `/athletes/{id}/documents` | Документы | superadmin, director, admin, coach* |
| POST | `/athletes/{id}/documents` | Добавить документ | superadmin, director, admin, coach* |
| GET | `/athletes/{id}/medical` | Медицина | superadmin, director, admin, coach* |
| POST | `/athletes/{id}/medical` | Добавить осмотр | superadmin, director, admin, coach* |
| GET | `/athletes/{id}/ranks` | История разрядов | superadmin, director, admin, coach* |
| POST | `/athletes/{id}/ranks` | Присвоить разряд | superadmin, director, admin |
| GET | `/athletes/{id}/achievements` | Достижения | superadmin, director, admin, coach* |
| POST | `/athletes/{id}/achievements` | Добавить достижение | superadmin, director, admin, coach* |
| POST | `/athletes/{id}/transfer` | Перевести в другой центр | superadmin, director, admin |

> \* — только своих спортсменов

---

## 7. Группы и расписание

### 7.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/groups` | Список групп | superadmin, director, admin, coach* |
| POST | `/groups` | Создать | superadmin, director, admin, coach |
| GET | `/groups/{id}` | Детально | superadmin, director, admin, coach* |
| PATCH | `/groups/{id}` | Редактировать | superadmin, director, admin, coach* |
| DELETE | `/groups/{id}` | Удалить | superadmin, director, admin |
| GET | `/groups/{id}/members` | Состав группы | superadmin, director, admin, coach* |
| POST | `/groups/{id}/members` | Добавить спортсмена | superadmin, director, admin, coach* |
| DELETE | `/groups/{id}/members/{athlete_id}` | Удалить из группы | superadmin, director, admin, coach* |
| GET | `/schedules` | Расписание | superadmin, director, admin, coach* |
| POST | `/schedules` | Создать занятие в расписании | superadmin, director, admin, coach |
| PATCH | `/schedules/{id}` | Редактировать | superadmin, director, admin, coach* |
| DELETE | `/schedules/{id}` | Удалить | superadmin, director, admin, coach* |
| GET | `/schedules/calendar` | Календарь на диапазон | superadmin, director, admin, coach* |

> \* — только свои группы

---

## 8. Посещаемость

### 8.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/attendance` | Посещаемость (фильтры) | superadmin, director, admin, coach* |
| POST | `/attendance` | Отметить посещение | coach |
| PATCH | `/attendance/{id}` | Исправить отметку | coach, admin |
| POST | `/attendance/batch` | Массовая отметка группы | coach |
| GET | `/attendance/stats` | Статистика посещаемости | superadmin, director, admin, coach* |
| GET | `/attendance/stats/heatmap` | Heatmap посещаемости | superadmin, director, admin |
| POST | `/attendance/qr/generate` | Сгенерировать QR для занятия | coach |
| POST | `/attendance/qr/scan` | Отметка по QR | athlete |

---

## 9. Отчёты

### 9.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/report-templates` | Шаблоны отчётов | Все |
| POST | `/report-templates` | Создать шаблон | methodist, superadmin |
| PATCH | `/report-templates/{id}` | Редактировать шаблон | methodist, superadmin |
| DELETE | `/report-templates/{id}` | Удалить шаблон | superadmin |
| GET | `/reports` | Список отчётов | superadmin, director, admin, coach* |
| POST | `/reports` | Создать отчёт | coach, admin |
| GET | `/reports/{id}` | Детально отчёта | superadmin, director, admin, coach* |
| PATCH | `/reports/{id}` | Редактировать (только draft) | author |
| DELETE | `/reports/{id}` | Удалить (только draft) | author, admin |
| POST | `/reports/{id}/submit` | Отправить на проверку | coach |
| POST | `/reports/{id}/approve` | Утвердить | admin, director, superadmin |
| POST | `/reports/{id}/reject` | Отклонить с комментарием | admin, director, superadmin |
| POST | `/reports/{id}/export` | Экспорт (xlsx, pdf, docx) | superadmin, director, admin, coach* |
| GET | `/reports/{id}/history` | История статусов | superadmin, director, admin, coach* |
| GET | `/reports/dashboard` | Сводка по отчётам | superadmin, director, admin |

> \* — только свои отчёты

---

## 10. Мероприятия и турниры

### 10.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/events` | Список мероприятий | Все |
| POST | `/events` | Создать | admin, director, superadmin |
| GET | `/events/{id}` | Детально | Все |
| PATCH | `/events/{id}` | Редактировать | admin, director, superadmin |
| DELETE | `/events/{id}` | Отменить | admin, director, superadmin |
| GET | `/events/{id}/competitions` | Соревнования в рамках мероприятия | Все |
| POST | `/events/{id}/competitions` | Добавить соревнование | admin, director, superadmin |
| GET | `/competitions/{id}` | Детально соревнования | Все |
| PATCH | `/competitions/{id}` | Редактировать | admin, director, superadmin |
| GET | `/competitions/{id}/participants` | Участники | Все |
| POST | `/competitions/{id}/register` | Зарегистрировать спортсмена | coach, admin |
| POST | `/competitions/{id}/results` | Внести результаты | admin, director |
| GET | `/competitions/{id}/results` | Результаты | Все |

---

## 11. Документы

### 11.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/document-templates` | Шаблоны документов | Все |
| POST | `/document-templates` | Создать шаблон | methodist, superadmin |
| PATCH | `/document-templates/{id}` | Редактировать шаблон | methodist, superadmin |
| GET | `/documents` | Список документов | superadmin, director, admin, author |
| POST | `/documents` | Создать документ | superadmin, director, admin, coach |
| GET | `/documents/{id}` | Детально | owner, reviewer, admin |
| PATCH | `/documents/{id}` | Редактировать | author (только draft) |
| POST | `/documents/{id}/submit` | Отправить на согласование | author |
| POST | `/documents/{id}/approve` | Согласовать | admin, director |
| POST | `/documents/{id}/reject` | Отклонить | admin, director |
| GET | `/documents/{id}/download` | Скачать PDF | owner, reviewer, admin |

---

## 12. Аналитика и BI

### 12.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/analytics/dashboard` | Главный дашборд | superadmin, director, admin, coach |
| GET | `/analytics/attendance` | Аналитика посещаемости | superadmin, director, admin |
| GET | `/analytics/coaches` | Эффективность тренеров | superadmin, director, admin |
| GET | `/analytics/centers` | Сравнение филиалов | superadmin, director |
| GET | `/analytics/dynamics` | Динамика показателей | superadmin, director, admin |

### 12.2 Параметры дашборда

```
GET /analytics/dashboard?period=month&date_from=2026-01-01&date_to=2026-05-29&center_id=uuid
```

**Response:**
```json
{
  "total_athletes": 150,
  "active_coaches": 12,
  "attendance_rate": 0.85,
  "new_athletes_this_period": 15,
  "reports_submitted": 24,
  "reports_approved": 18,
  "upcoming_events": 3,
  "charts": {
    "attendance_by_group": [],
    "reports_by_status": [],
    "new_athletes_by_month": []
  }
}
```

---

## 13. Уведомления

### 13.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/notifications` | Мои уведомления | Authenticated |
| PATCH | `/notifications/{id}/read` | Отметить прочитанным | Authenticated |
| PATCH | `/notifications/read-all` | Прочитать все | Authenticated |

---

## 14. Аудит

### 14.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/audit-logs` | Логи действий | superadmin, director |

---

## 15. Импорт / Экспорт

### 15.1 Эндпоинты

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| POST | `/import/athletes` | Импорт спортсменов из Excel | admin, superadmin |
| POST | `/import/attendance` | Импорт посещаемости | admin, coach |
| GET | `/export/athletes` | Экспорт спортсменов в Excel | superadmin, admin, coach* |
| GET | `/export/attendance` | Экспорт посещаемости | superadmin, admin, coach* |
| GET | `/export/reports/{id}` | Экспорт отчёта (xlsx/pdf/docx) | superadmin, admin, author |
