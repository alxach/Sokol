# ADR-014: Единая модалка создания/редактирования спортсмена

## Status
Accepted

## Date
2026-06-28

## Context

В системе «СОКОЛ» спортсмена можно создать из двух точек:
1. Страница **«Мои спортсмены»** (`/athletes`) — кнопка «Добавить»
2. Страница **«Мои группы»** (`/groups`) — кнопка «+ Новый» в форме создания группы или в деталях группы

В обоих случаях создаётся одна и та же сущность `Athlete` с одинаковым набором полей. Однако формы отличались:

- В `/athletes` — `AthleteModal` (полная: ФИО, вид спорта, разряд, дата рождения, город, статус, тренер, группа + инлайн-создание группы)
- В `/groups` — `NewAthleteForm` (упрощённая: только ФИО, разряд, дата рождения; остальные поля — авто)

Это приводило к расхождению UX: тренер видел разный набор полей в зависимости от того, откуда создавал спортсмена.

## Decision

### Выделить AthleteModal в общий компонент

- Создан `frontend/src/components/athlete-modal.tsx`
- Компонент экспортирует `AthleteModal` и константы `disciplines`, `rankOptions`, `statusOptions`
- Пропсы: `athlete` (`Athlete | null` — null для создания), `coachName?`, `coachDiscipline?`, `coachCity?`, `onClose`, `onSaved?.(newId?)`
- `onSaved` теперь возвращает `newId` для сценариев, где нужно передать ID созданного спортсмена в родительскую форму (например, в `editAthleteIds` при создании группы)

### Изменения в athletes.tsx

- Импорт `AthleteModal` и `disciplines` из `@/components/athlete-modal`
- Удалён локальный `AthleteModal` (был ~250 строк)
- Удалены локальные `rankOptions`, `statusOptions`

### Изменения в groups.tsx

- Импорт `AthleteModal` из `@/components/athlete-modal`
- Замена `NewAthleteForm` на `AthleteModal` в модалке `AddAthleteModal`
- При создании спортсмена в контексте формы создания группы (`groupId` пустой) — ID нового спортсмена передаётся в `onAddToEditIds`

### Преимущества

- Единый UX создания спортсмена во всех точках входа
- Все поля (включая статус, город, выбор группы, инлайн-создание группы) доступны везде
- Упрощение поддержки — один компонент вместо двух
- `onSaved` с возвратом `newId` открывает возможность для более гибких сценариев

### Недостатки

- `AthleteModal` напрямую работает с `athletes` и `groups` из `mock-data` (не инжектит зависимости) — при переходе на TanStack Query потребуется рефакторинг

## Consequences

- `frontend/src/components/athlete-modal.tsx` — новый файл
- `frontend/src/routes/athletes.tsx` — удалено ~250 строк
- `frontend/src/routes/groups.tsx` — удалено ~80 строк (NewAthleteForm)
- При миграции на API: `AthleteModal` нужно будет переписать на `useMutation` с пропсами вместо прямых вызовов mock-data

## Notes

- `disciplines`, `rankOptions`, `statusOptions` экспортируются для обратной совместимости (используются в `athletes.tsx` для чипсов фильтра)
- `calcAge` и `syncGroup` — внутренние утилиты компонента
