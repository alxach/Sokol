# План реализации Положения ред. 8 (ЦСиЗ-26-П022)

> Дата: 2026-07-14
> ADR: ADR-019 (обновлён на ред. 8)

## Текущее состояние

| Модуль | Frontend | Backend | Gap |
|--------|----------|---------|-----|
| Reports | ✅ 5 KPI, форма, Word | ✅ Report с data_json | Нет payoutTier, programId, norm-валидации |
| Plans | ✅ CRUD, импорт/экспорт | ❌ Только mock | Нет backend-модели, нет валидации |
| CommissionProtocol | ❌ | ❌ | Полностью отсутствует |
| IncentiveProgram | ❌ | ❌ | Полностью отсутствует |
| CSECenter | ❌ | ⚠️ Generic Center | Нет city, нет seed 11 центров |

---

## Фаза 1 — Справочники

### 1.1 Extend Center → CSECenter
- `backend/app/models/organization.py`: добавить `city`, `center_type`
- Seed 11 ЦСЕ из Приложения №1
- Миграция

### 1.2 Create IncentiveProgram
- `backend/app/models/incentive_program.py`
- Поля: regulationNumber, regulationDate, revision, maxPayout, minPayout, ndflRate, insuranceRate, isDiscretionary, status
- Seed: ред. 8, активна
- API: GET /api/v1/incentive-programs

### 1.3 Participant categories reference
- Вынести planCategories из mock-data в общий константный файл

---

## Фаза 2 — Reports (обновление)

### 2.1 Extend Report model
- Добавить: program_id FK, payout_tier, commission_protocol_id FK
- Миграция

### 2.2 Confirmation forms in ReportTemplate
- Расширить ReportField: confirmationForm ("mandatory_in_report" | "on_request" | "none")
- UI: показывать форму подтверждения рядом с каждым критерием

### 2.3 Norm validation in UI
- ReportDetailModal: автоматическая проверка выполнения критериев
- Зелёная галочка / красный крестик по каждому критерию

### 2.4 Auto-calculate payoutTier
- При отправке отчёта: определение payoutTier на основе выполнения

---

## Фаза 3 — Plans (backend + валидация)

### 3.1 Backend EventPlan + PlanItem
- Модели: event_plans, plan_items
- FK: coach_id, center_id, program_id

### 3.2 Validation of v8 restrictions
- Лекции ≤ 50% за год
- Запрет дублирования мероприятий
- Замена раздела 4 → раздел 3 при невозможности

### 3.3 Plans API CRUD
- GET/POST/PUT /api/v1/event-plans
- POST .../submit, .../approve, .../reject

### 3.4 Plan deadline indicator
- Дедлайн: за 10 рабочих дней до начала квартала
- UI-индикатор + напоминания

---

## Фаза 4 — CommissionProtocol (новый модуль)

### 4.1 CommissionProtocol + PayoutRow models
- protocol: number, date, beneficiary, period, center, voting
- payoutRow: coach, sport, gross, ndfl, insurance, net

### 4.2 Gross/net calculation
- formula: gross = net / (1 - ndfl_rate - insurance_rate)
- На основе IncentiveProgram rates

### 4.3 Commission protocols UI
- Список + форма создания + таблица выплат
- Экспорт по форме Приложения №6

### 4.4 Protocol ↔ Report integration
- При утверждении протокола → Report.commission_protocol_id

---

## Фаза 5 — Интеграция и UI

### 5.1 Coach Dashboard — сводка критериев
### 5.2 Admin Dashboard — дедлайн планов
### 5.3 Дисклеймер факультативности

---

## Порядок и оценка

| # | Задача | Дни |
|---|--------|-----|
| 1.1 | CSECenter | 0.5 |
| 1.2 | IncentiveProgram | 0.5 |
| 1.3 | Категории участников | 0.5 |
| 2.1 | Расширение Report | 0.5 |
| 2.2 | Формы подтверждения | 0.5 |
| 2.3 | Норм-валидация | 1 |
| 2.4 | Расчёт payoutTier | 0.5 |
| 3.1 | Backend EventPlan | 1 |
| 3.2 | Валидация ограничений | 1 |
| 3.3 | API CRUD планов | 1 |
| 3.4 | Дедлайн плана | 0.5 |
| 4.1 | CommissionProtocol | 1 |
| 4.2 | Расчёт gross/net | 0.5 |
| 4.3 | UI Протоколы | 2 |
| 4.4 | Интеграция протокол↔отчёт | 0.5 |
| 5.1 | Dashboard тренера | 1 |
| 5.2 | Dashboard админа | 0.5 |
| 5.3 | Дисклеймер | 0.5 |
| **Итого** | | **~12** |
