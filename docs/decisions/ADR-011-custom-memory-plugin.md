# ADR-011: Custom Memory Plugin (замена agentmemory)

## Status
Accepted

## Date
2026-06-22

## Supersedes
ADR-010 — opencode-agent-memory (Letta-style) как временное решение

## Context
Для эффективной работы AI-агента требуется персистентная память между сессиями. Ранее были рассмотрены варианты:

1. **III engine (Docker/native)** — не работает на Windows (баг v0.11.2)
2. **@agentmemory/mcp standalone** — данные сохраняются, но opencode не экспортирует его tools
3. **opencode-agent-memory (Letta-style)** — работает, но без auto-capture

Требования к полноценной памяти:
- **Auto-capture**: агент сам запоминает важные события, баги, архитектурные решения
- **Tools**: возможность вручную сохранять, искать, просматривать и удалять записи
- **Персистентность**: данные живут между сессиями и после перезапуска
- **Windows-совместимость**: без Docker, III engine, HTTP API
- **Контекстная инжекция**: релевантные записи автоматически подставляются в system prompt
- **Совместимость**: данные должны быть читаемы человеком (JSON), без проприетарных форматов

## Decision
Написать **собственный плагин для opencode** `sokol-memory`, который:

1. Хранит данные в JSON-файле `~/.config/opencode/sokol-memory/store.json`
2. Формат записи (совместимый с agentmemory):
   ```json
   {
     "id": "mem_xxx",
     "type": "fact|architecture|workflow|bug|feature",
     "title": "Краткий заголовок",
     "content": "Полное описание",
     "concepts": ["ключевое", "слово"],
     "createdAt": "2026-06-22T...",
     "updatedAt": "2026-06-22T...",
     "strength": 7,
     "version": 1
   }
   ```
3. Предоставляет tools:
   - `memory_save` — создать/обновить запись
   - `memory_recall` — поиск по тексту/концептам
   - `memory_list` — список всех записей с фильтрацией по типу
   - `memory_delete` — удалить запись
4. Имеет auto-capture хуки:
   - `tool.execute.after` — запись важных действий (баги, коммиты, изменения)
   - `session.created` / `session.deleted` — логирование сессий
   - `session.error` — автоматическая запись ошибок
   - `experimental.chat.system.transform` — инжекция контекста в system prompt
   - `experimental.session.compacting` — сохранение состояния при сжатии
5. Регистрирует команды:
   - `/recall <query>` — поиск по памяти
   - `/remember <text>` — быстрое сохранение

## Alternatives Considered

### Расширение opencode-agent-memory хуками
- **Плюсы:** уже установлен, меньше кода
- **Минусы:** архитектура opencode-agent-memory (Letta-style: markdown + memory blocks) не предназначена для auto-capture; хуки пришлось бы добавлять в чужой плагин, что создаёт конфликт ownership; при обновлении оригинального плагина наши изменения потеряются
- **Отклонён:** лучше написать свой плагин с правильной архитектурой

### Использование agentmemory JS API (index.mjs)
- **Как работает:** `@agentmemory/agentmemory` предоставляет JS API для работы с памятью (сохранение, поиск, сжатие)
- **Проблема:** index.mjs завязан на `iii-sdk` и `registerWorker` — он предназначен для работы внутри III engine. Без III engine этот код не запускается.
- **Отклонён:** III engine — единственный способ использовать agentmemory JS API

### Написание MCP сервера
- **Плюсы:** MCP tools будут доступны opencode через MCP протокол
- **Минусы:** opencode (big-pickle) не экспортирует MCP tools от agentmemory — нет гарантии, что наши tools будут видны; лишний слой (MCP сервер как отдельный процесс)
- **Отклонён:** плагин — правильный способ расширения opencode

## Consequences
- Плагин хранится в `.opencode/plugins/sokol-memory.ts` — проект opencode видит его локально
- Старые данные из `~/.agentmemory/standalone.json` можно импортировать (но миграция не обязательна)
- `opencode-agent-memory` отключается (замена на sokol-memory)
- Плагин не зависит от внешних npm-пакетов (кроме @opencode-ai/plugin для типов) — минимум зависимостей
- При перезапуске opencode плагин загружается автоматически
