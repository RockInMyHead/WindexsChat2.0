# Настройка прокси с Undici

## Проблема
`https-proxy-agent` не работает с встроенным `fetch` в Node.js 18+, который использует Undici под капотом.

## Решение
Используем `ProxyAgent` из пакета `undici` вместо `HttpsProxyAgent`.

## Установка
```bash
npm install undici
```

## Использование

### В server.js:
```javascript
import { ProxyAgent } from 'undici';

const PROXY_URL = process.env.PROXY_URL || 'http://username:password@host:port';
const proxyAgent = new ProxyAgent({
  uri: PROXY_URL
});

// В fetch запросах используем dispatcher вместо agent:
const response = await fetch(url, {
  dispatcher: proxyAgent,
  method: 'POST',
  headers: { ... }
});
```

## Ключевые различия

| https-proxy-agent | Undici ProxyAgent |
|---|---|
| `agent: proxyAgent` | `dispatcher: proxyAgent` |
| Работает с Node.js https модулем | Работает с встроенным fetch (Undici) |
| Не поддерживает HTTPS при необходимости | Автоматически определяет протокол |

## Примеры использования

### OpenAI API
```javascript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  dispatcher: proxyAgent,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({ messages, model })
});
```

### Другие API
```javascript
const response = await fetch('https://api.example.com/endpoint', {
  dispatcher: proxyAgent
});
```

## Переменные окружения

```bash
# В .env или на сервере
PROXY_URL=http://username:password@45.147.180.58:8000
```

## Логирование прокси запросов

Для отладки можно добавить логирование:

```javascript
import { ProxyAgent } from 'undici';

const proxyAgent = new ProxyAgent({
  uri: PROXY_URL
});

// Все fetch запросы с dispatcher будут идти через прокси
console.log(`Using proxy: ${PROXY_URL}`);
```
