# Скрыть колонку «Тренер» для coach на странице `/athletes`

## Изменения в `frontend/src/routes/athletes.tsx`

### 1. Скрыть заголовок «Тренер» (строка 252)
```tsx
// Было:
<TableHead>Тренер</TableHead>
// Стало:
{!isCoach && <TableHead>Тренер</TableHead>}
```

### 2. Скрыть ячейку с именем тренера (строка 281)
```tsx
// Было:
<TableCell className="text-sm text-muted-foreground">{a.coach}</TableCell>
// Стало:
{!isCoach && <TableCell className="text-sm text-muted-foreground">{a.coach}</TableCell>}
```

### 3. Поправить `colSpan` для пустой таблицы (строка 333)
```tsx
// Было:
<TableCell colSpan={9} className="...">
// Стало:
<TableCell colSpan={isCoach ? 9 : 10} className="...">
```

## Проверка
- `npx tsc --noEmit --pretty` — не должно быть ошибок в `athletes.tsx`
- Визуально: под coach колонка «Тренер» не отображается, под admin — отображается
