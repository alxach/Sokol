# Fix: Добавить Outlet в reports.tsx для /reports/new

## Проблема
`/reports/new` — дочерний маршрут `/reports`, но родительский компонент `ReportsPage` не рендерит `<Outlet />`. При переходе на `/reports/new` показывается только список отчётов, форма не отображается.

## Изменения в `frontend/src/routes/reports.tsx`

### 1. Добавить `Outlet` и `useRouterState` в импорт
```typescript
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
```

### 2. В компоненте `ReportsPage` добавить проверку на активный дочерний маршрут
В начале функции:
```typescript
const router = useRouterState();
const isChildRoute = router.matches.some((m) => m.routeId.startsWith("/reports/"));
```

### 3. В JSX заменить рендер на условный
```tsx
if (isChildRoute) {
  return (
    <AppShell title="Отчёты" subtitle="...">
      <Outlet />
    </AppShell>
  );
}
```

Весь остальной код (фильтры, таблица, модалка) остаётся как есть — он будет рендериться только на `/reports`.

## Проверка
- `npx tsc --noEmit --pretty` — без ошибок
- `/reports` — список отчётов работает как раньше
- `/reports/new` — открывается форма создания
