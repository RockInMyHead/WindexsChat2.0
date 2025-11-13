# Настройка прокси

## Установка прокси

В проекте настроен HTTP прокси для всех внешних API запросов.

### Переменные окружения

Создайте файл `.env` в корне проекта со следующим содержимым:

```bash
# OpenAI API Configuration для сервера
OPENAI_API_KEY=sk-proj-ваш_api_ключ_здесь

# Proxy Configuration
# Формат: http://username:password@host:port
PROXY_URL=http://pb3jms:85pNLX@45.147.180.58:8000
```

### Настройка на сервере

Если развертываете на сервере, установите переменные окружения:

```bash
export OPENAI_API_KEY="sk-proj-ваш_api_ключ_здесь"
export PROXY_URL="http://pb3jms:85pNLX@45.147.180.58:8000"
```

### API, использующие прокси

- OpenAI API (чат и генерация планов)
- CoinGecko API (курсы криптовалют)
- DuckDuckGo API (поиск в интернете)
- Wikipedia API (русский и английский)
- Glosbe API (определения и переводы)
- NewsAPI (новости)
- Stack Exchange API (технические вопросы)

### Безопасность

- Никогда не коммитите `.env` файл в git
- `.env` должен быть в `.gitignore`
- Используйте надежные прокси-серверы
