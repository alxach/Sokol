# ADR-002: Multiple Sick Leave Periods per Coach

## Status
Accepted

## Date
2026-06-18

## Context
Тренерам нужно указывать периоды больничного с автоматическим вычислением статуса «На больничном». Ранее статус выставлялся вручную через поле `status`, без привязки к датам.

Требования:
- Тренер может иметь 0..N периодов больничного в году
- Статус «На больничном» вычисляется автоматически, если сегодня попадает в любой период
- Приоритет статусов: больничный → отпуск → базовый статус
- Редактирование через DatePicker на странице профиля и в карточке тренера

## Decision
Реализовано по той же схеме, что и отпуска:

### Backend: отдельная таблица `coach_sick_leaves`
Модель `CoachSickLeave` со связью `OneToMany` к `Coach`. Полная аналогия с `CoachVacation`.

```python
class CoachSickLeave(TimestampMixin, Base):
    __tablename__ = "coach_sick_leaves"
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coaches.id"))
    start_date: Mapped[Date]
    end_date: Mapped[Date]
```

### Frontend: массив `sickLeaves: VacationPeriod[]`
Тип `VacationPeriod` переиспользован (та же структура `{ start, end }`).

- Функция `isOnSickLeave()` — проверяет все периоды
- `getCoachStatus()` — вызывает `isOnSickLeave` первой, затем `isOnVacation`, затем `coach.status`
- На странице профиля — отдельная карточка «Больничный» со своим режимом редактирования (✏️)
- В модалке тренера — секция «Больничный» с `input[type=date]`

### Обработка некорректных дат
Если `end < start` (конец раньше начала), период считается однодневным на дату старта. Это предотвращает ложный статус «Здоров» при опечатке в дате.

## Alternatives Considered
- **Общая таблица `coach_periods` с типом (vacation/sick)**: сложнее запросы, не даёт выигрыша
- **Хранение в JSON-поле**: те же аргументы, что в ADR-001

## Consequences
- `coach_sick_leaves` создана, миграция накатывается
- Статус «На больничном» в `statusStyle` уже был — стилизация не требуется
- `coach.status` у TR-007 изменён с «На больничном» на «Активный», т.к. статус теперь вычисляется из `sickLeaves`
- При подключении реального API — аналогичная миграция оверрайдов из localStorage
