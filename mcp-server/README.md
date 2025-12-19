# Tavily MCP Server

Простой MCP сервер для поиска через Tavily API.

## Настройка

1. Получите API ключ на https://tavily.com/
2. Создайте файл `.env` в этой папке:
```
TAVILY_API_KEY=ваш_ключ_tavily
MCP_PORT=8002
```

## Запуск

```bash
npm start
```

Сервер будет доступен на https://ai.windexs.ru/api/mcp

## API

### POST /search
Выполняет поиск через Tavily.

**Request:**
```json
{
  "query": "ваш поисковый запрос",
  "max_results": 5
}
```

**Response:**
```json
{
  "query": "ваш поисковый запрос",
  "results": [
    {
      "title": "Заголовок результата",
      "url": "https://example.com",
      "content": "Содержимое страницы...",
      "score": 0.95
    }
  ],
  "answer": "Краткий ответ от Tavily (если доступен)"
}
```
