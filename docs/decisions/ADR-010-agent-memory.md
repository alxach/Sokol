# ADR-010: Persistent Agent Memory — отказ от III engine / Docker

## Status
Accepted

## Date
2026-06-22

## Context
Для эффективной работы AI-агента (opencode) требуется **персистентная память между сессиями**: факты о проекте, архитектурные решения, найденные баги, workflow-инструкции. Без памяти агент каждый раз начинает с нуля.

Рассматривались следующие требования:
- Данные должны сохраняться между сессиями агента
- Решение должно работать на Windows (основная ОС разработчика)
- Минимум внешних зависимостей (не усложнять инфраструктуру проекта)
- Данные должны оставаться локальными (не уходить в облако)

## Decision
Использовать **opencode-agent-memory** (Letta-style) — плагин для opencode, хранящий память в markdown-файлах с YAML frontmatter.

Данные хранятся:
- Глобальные блоки: `~/.config/opencode/memory/*.md`
- Проектные блоки: `.opencode/memory/*.md` (добавлены в .gitignore)
- Журнал: `~/.config/opencode/journal/*.md`

## Alternatives Considered

### III engine (Docker) + agentmemory HTTP API
- **Как работает:** Docker-контейнер `iiidev/iii:0.11.2` запускает III engine, agentmemory подключается к нему через HTTP API (порт 3111)
- **Результат:** HTTP API возвращает 404 на ВСЕ эндпоинты — баг роутинга III engine v0.11.2 на Windows
- **Причина отказа:** III engine — Rust-бинарник, pinned к версии 0.11.2 (agentmemory не поддерживает новее). Баг не чинится — это проблема совместимости бинарника с Windows.
- Docker-образ той же версии имеет ту же проблему (+ требует монтирования config.yaml, который не входит в образ)

### III engine (native) + agentmemory HTTP API
- **Как работает:** `npx @agentmemory/agentmemory` запускает iii.exe напрямую
- **Результат:** iii.exe падает с code=1 (address 127.0.0.1:3111 already in use или engine не стартует)
- **Причина отказа:** Тот же баг III engine v0.11.2 на Windows

### @agentmemory/mcp standalone (InMemoryKV)
- **Как работает:** MCP-сервер `@agentmemory/mcp` запускается без HTTP API, хранит данные в `~/.agentmemory/standalone.json`
- **Результат:** Сервер работает, данные сохраняются, но opencode (модель big-pickle) не экспортирует его MCP-tools (`memory_save` и др.). Память есть, но агент не может к ней обратиться.
- **Причина отказа:** Бесполезно — данные пишутся, но не читаются агентом

### opencode-agent-memory (выбран)
- **Как работает:** Плагин для opencode, предоставляет 3 memory-tools (`memory_list`, `memory_set`, `memory_replace`) и 3 journal-tools. Данные — markdown-файлы на диске.
- **Плюсы:**
  - Не требует сервера, Docker, HTTP API
  - Работает на Windows из коробки
  - markdown-файлы читаемы человеком без специальных инструментов
  - Семантический поиск через локальные эмбеддинги (all-MiniLM-L6-v2) — данные не покидают машину
  - Журналирование с тегами для поиска
  - Глобальные + проектные блоки
- **Минусы:**
  - Нет автоматического захвата контекста (в отличие от agentmemory-capture.ts)
  - Нет LLM-сжатия и консолидации
  - Агент должен явно вызывать сохранение

## Consequences
- Память теперь работает и доступна агенту в каждой сессии
- Первые 3 блока (persona, human, project) создаются автоматически при первом запуске
- Нужно явно просить агента сохранять важную информацию (не автоматически)
- Старые данные из `~/.agentmemory/standalone.json` (17 memory-объектов) потеряны — миграция нецелесообразна из-за разницы форматов
- Больше не нужны: Docker-контейнер III engine, процесс `@agentmemory/mcp`, файл `start-agentmemory.ps1`
