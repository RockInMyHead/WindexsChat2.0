import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ProxyAgent } from 'undici';
import { DatabaseService } from './src/lib/database.js';
import { marketRouter } from './src/routes/market.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 1062;

// Стоимость токенов за 1M токенов в долларах (на декабрь 2025)
const getTokenPrices = (model) => {
  const prices = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-5.1': { input: 5.00, output: 15.00 }
  };
  return prices[model] || prices['gpt-4o-mini'];
};

// Детектор market queries
const isMarketQuery = (query) => {
  if (!query || typeof query !== 'string') return false;
  const lowerQuery = query.toLowerCase();

  // Проверяем на упоминание биткойна в различных формах
  const hasBitcoin = lowerQuery.includes('биткойн') ||
                     lowerQuery.includes('биткоин') ||
                     lowerQuery.includes('bitcoin') ||
                     lowerQuery.includes('btc');

  // Проверяем на слова, указывающие на запрос цены/курса
  const hasPriceQuery = lowerQuery.includes('курс') ||
                       lowerQuery.includes('цена') ||
                       lowerQuery.includes('стоимость') ||
                       lowerQuery.includes('стоит') ||
                       lowerQuery.includes('сколько') ||
                       lowerQuery.includes('rate') ||
                       lowerQuery.includes('price') ||
                       lowerQuery.includes('cost');

  return hasBitcoin && hasPriceQuery;
};

// Получение market snapshot для сервера
const getMarketSnapshot = async () => {
  try {
    console.log('📊 Server: Fetching market snapshot...');
    const response = await fetch('http://localhost:1062/api/market/quote?vs=usd,eur,rub', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('⚠️ Server: Market snapshot fetch failed:', response.status);
      return '[MARKET_DATA_UNAVAILABLE]';
    }

    const data = await response.json();
    console.log('📊 Server: Market snapshot received');

    // Форматируем данные для AI
    const quote = data.quote;
    const asOf = new Date(data.asOf).toISOString();

    return `MARKET_SNAPSHOT (Source: ${data.provider}, AsOf: ${asOf}):
BTC/USD: ${quote.usd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
BTC/EUR: ${quote.eur?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
BTC/RUB: ${quote.rub?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
24h Change: ${quote.usd_24h_change?.toFixed(2) || 'N/A'}%
Market Cap: ${quote.usd_market_cap ? '$' + (quote.usd_market_cap / 1e9).toFixed(2) + 'B' : 'N/A'}
24h Volume: ${quote.usd_24h_vol ? '$' + (quote.usd_24h_vol / 1e9).toFixed(2) + 'B' : 'N/A'}
Cached: ${data.cached}`;
  } catch (error) {
    console.error('❌ Server: Market snapshot error:', error);
    return '[MARKET_DATA_ERROR]';
  }
};

// Настройка прокси для Undici (встроенный fetch в Node.js)
const PROXY_URL = process.env.PROXY_URL;
const proxyAgent = PROXY_URL ? new ProxyAgent({
  uri: PROXY_URL
}) : null;

// Middleware
app.use(cors({
  origin: ['https://ai.windexs.ru', 'https://www.ai.windexs.ru', 'http://ai.windexs.ru', 'http://www.ai.windexs.ru'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Market API Routes
app.use('/api/market', marketRouter);

// API Routes

// Создать новую сессию чата
app.post('/api/sessions', (req, res) => {
  try {
    console.log('POST /api/sessions called with:', req.body, 'headers:', req.headers.origin);
    const { title = 'Новый чат' } = req.body;
    const sessionId = DatabaseService.createSession(title);
    console.log('Session created successfully:', sessionId);
    res.json({ sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Получить все сессии
app.get('/api/sessions', (req, res) => {
  try {
    console.log('GET /api/sessions called, headers:', req.headers.origin);
    const sessions = DatabaseService.getAllSessions();
    console.log('Returning', sessions.length, 'sessions');
    res.json(sessions);
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Получить сообщения сессии
app.get('/api/sessions/:sessionId/messages', (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = DatabaseService.loadMessages(parseInt(sessionId));
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Сохранить сообщение
app.post('/api/messages', (req, res) => {
  try {
    const { sessionId, role, content, artifactId } = req.body;

    if (!sessionId || !role || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const messageId = DatabaseService.saveMessage(sessionId, role, content, artifactId || null);
    res.json({ messageId });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Обновить заголовок сессии
app.patch('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    DatabaseService.updateSessionTitle(parseInt(sessionId), title);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating session title:', error);
    res.status(500).json({ error: 'Failed to update session title' });
  }
});

// Удалить сессию
app.delete('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    DatabaseService.deleteSession(parseInt(sessionId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// === Artifacts API ===

// Генерировать артефакт через OpenAI
app.post('/api/artifacts/generate', async (req, res) => {
  try {
    const { prompt, model = 'gpt-4o-mini' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured on server' });
    }

    const systemPrompt = `Ты — эксперт-разработчик, создающий полноценные веб-проекты на React + TypeScript + Vite.

ВАЖНО: Ты ДОЛЖЕН вернуть валидный JSON-объект следующей структуры:
{
  "assistantText": "Краткое описание созданного сайта (2-3 предложения)",
  "artifact": {
    "title": "Название сайта",
    "files": {
      "/index.html": "HTML код",
      "/src/main.tsx": "React entry point",
      "/src/App.tsx": "Главный компонент",
      "/src/index.css": "Tailwind CSS стили",
      "/src/components/Component1.tsx": "дополнительные компоненты",
      ...другие файлы
    },
    "deps": {
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "tailwindcss": "^3.4.0",
      ...другие зависимости если нужны
    }
  }
}

ОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ:
1. Всегда включай файлы: /index.html, /src/main.tsx, /src/App.tsx, /src/index.css
2. Используй Tailwind CSS через NPM зависимость (НЕ CDN!)
3. Создавай СОВРЕМЕННЫЙ, КРАСИВЫЙ дизайн с ОТЛИЧНЫМ UX
4. Код должен быть полностью рабочим и self-contained
5. Используй современные практики React (hooks, функциональные компоненты)
6. ОБЯЗАТЕЛЬНО разделяй код на компоненты в /src/components/
7. Делай сайты ИНТЕРАКТИВНЫМИ и ФУНКЦИОНАЛЬНЫМИ, а не просто статичными
8. В deps ОБЯЗАТЕЛЬНО включи: "tailwindcss": "^3.4.0"

ДИЗАЙН-ТРЕБОВАНИЯ (ОБЯЗАТЕЛЬНО):
- Используй современные градиенты (bg-gradient-to-br, from-blue-500 to-purple-600)
- Добавляй тени и hover эффекты (shadow-xl, hover:shadow-2xl, transition-all)
- Делай отзывчивый дизайн (responsive breakpoints: sm:, md:, lg:, xl:)
- Добавляй анимации (animate-fade-in, animate-bounce, группируй transition)
- Используй красивую типографику (font-bold, text-4xl, leading-relaxed)
- Добавляй иконки через emoji или SVG
- Создавай пространство (py-8, px-6, gap-6, space-y-4)
- Используй современные цвета (slate-900, indigo-500, emerald-400)

ИНТЕРАКТИВНОСТЬ (ОБЯЗАТЕЛЬНО):
- Добавляй useState для управления состоянием
- Кнопки должны делать что-то полезное (не просто декорация)
- Формы должны обрабатывать ввод данных
- Добавляй модальные окна, тултипы, dropdown меню
- Используй useEffect для сайд-эффектов
- Добавляй localStorage для сохранения данных
- Делай анимированные переходы между состояниями

СТРУКТУРА КОМПОНЕНТОВ (РЕКОМЕНДУЕТСЯ):
/src/App.tsx - главный компонент с логикой
/src/components/Header.tsx - шапка сайта
/src/components/Hero.tsx - главный блок
/src/components/Features.tsx - секция преимуществ
/src/components/Contact.tsx - форма контактов
/src/components/Footer.tsx - подвал

ПРИМЕРЫ ОТЛИЧНЫХ РЕШЕНИЙ:

Для лендинга:
- Hero с градиентом и CTA кнопкой
- Секция с карточками преимуществ (минимум 3-6 карточек)
- Форма подписки/контактов с валидацией
- Testimonials с отзывами клиентов
- Footer с социальными ссылками

Для приложения:
- Боковая навигация или табы
- Интерактивные формы с обработкой данных
- Модальные окна для действий
- Анимированные списки (добавление/удаление)
- Уведомления об успехе/ошибке

Для игры:
- Canvas или div-based рендеринг
- Обработка клавиатуры/мыши
- Система очков и рекордов
- Кнопки управления для мобильных
- Звуковые эффекты (опционально)

СТРУКТУРА index.html:
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Название</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

СТРУКТУРА main.tsx:
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

СТРУКТУРА index.css:
@tailwind base;
@tailwind components;
@tailwind utilities;

КАЧЕСТВО КОДА:
- Пиши чистый, читаемый код с комментариями
- Используй TypeScript типы (React.FC, useState<type>)
- Группируй логику в хуки (useGameLogic, useFormValidation)
- Выноси константы в верх файла
- Используй деструктуризацию и spread оператор

НЕ ДЕЛАЙ:
❌ Простые статичные страницы с одним текстом
❌ Минималистичные сайты без функционала
❌ CDN загрузки (только NPM dependencies)
❌ Inline стили (только Tailwind классы)

ДЕЛАЙ:
✅ Многокомпонентные проекты с хорошей архитектурой
✅ Интерактивные элементы с реальным функционалом
✅ Красивый modern дизайн с градиентами и анимациями
✅ Адаптивность для всех экранов
✅ Полезный UX с понятными действиями

Отвечай ТОЛЬКО валидным JSON, без markdown форматирования, без комментариев.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      ...(proxyAgent && { dispatcher: proxyAgent }),
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      return res.status(openaiResponse.status).json({
        error: 'OpenAI API error',
        details: errorText
      });
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'No content in OpenAI response' });
    }

    // Парсим JSON из ответа
    let parsedData;
    try {
      // Пытаемся извлечь JSON из markdown блока, если есть
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      parsedData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error('Failed to parse JSON from OpenAI:', content);
      return res.status(500).json({
        error: 'Invalid JSON response from OpenAI',
        content: content.substring(0, 500)
      });
    }

    // Валидация структуры
    if (!parsedData.artifact || !parsedData.artifact.files) {
      return res.status(500).json({ error: 'Invalid artifact structure' });
    }

    // Проверка обязательных файлов
    const requiredFiles = ['/index.html', '/src/App.tsx', '/src/main.tsx', '/src/index.css'];
    const missingFiles = requiredFiles.filter(file => !parsedData.artifact.files[file]);
    
    if (missingFiles.length > 0) {
      return res.status(500).json({
        error: 'Missing required files',
        missingFiles
      });
    }

    res.json(parsedData);

  } catch (error) {
    console.error('Error generating artifact:', error);
    res.status(500).json({
      error: 'Failed to generate artifact',
      details: error.message
    });
  }
});

// Создать артефакт
app.post('/api/artifacts', (req, res) => {
  try {
    const { sessionId, type, title, files, deps } = req.body;

    if (!sessionId || !type || !title || !files) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Валидация типа
    if (type !== 'website') {
      return res.status(400).json({ error: 'Invalid artifact type. Only "website" is supported.' });
    }

    // Валидация файлов
    if (typeof files !== 'object' || Object.keys(files).length === 0) {
      return res.status(400).json({ error: 'Files must be a non-empty object' });
    }

    // Проверка обязательных файлов
    const requiredFiles = ['/index.html', '/src/App.tsx', '/src/main.tsx', '/src/index.css'];
    const missingFiles = requiredFiles.filter(file => !files[file]);
    if (missingFiles.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required files', 
        missingFiles 
      });
    }

    // Проверка размера (максимум 400KB)
    const totalSize = Object.values(files).reduce((sum, content) => sum + content.length, 0);
    const maxSize = 400 * 1024; // 400KB
    if (totalSize > maxSize) {
      return res.status(400).json({ 
        error: 'Artifact too large', 
        maxSize: '400KB',
        actualSize: `${Math.round(totalSize / 1024)}KB`
      });
    }

    const artifactId = DatabaseService.createArtifact(
      parseInt(sessionId),
      type,
      title,
      files,
      deps || null
    );

    res.json({ artifactId });
  } catch (error) {
    console.error('Error creating artifact:', error);
    res.status(500).json({ error: 'Failed to create artifact' });
  }
});

// Получить артефакт по ID
app.get('/api/artifacts/:artifactId', (req, res) => {
  try {
    const { artifactId } = req.params;
    const artifact = DatabaseService.getArtifact(parseInt(artifactId));
    
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.json(artifact);
  } catch (error) {
    console.error('Error getting artifact:', error);
    res.status(500).json({ error: 'Failed to get artifact' });
  }
});

// Обновить артефакт
app.put('/api/artifacts/:artifactId', (req, res) => {
  try {
    const { artifactId } = req.params;
    const { title, files, deps } = req.body;

    if (!title || !files) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Валидация файлов
    if (typeof files !== 'object' || Object.keys(files).length === 0) {
      return res.status(400).json({ error: 'Files must be a non-empty object' });
    }

    // Проверка размера
    const totalSize = Object.values(files).reduce((sum, content) => sum + content.length, 0);
    const maxSize = 400 * 1024;
    if (totalSize > maxSize) {
      return res.status(400).json({ 
        error: 'Artifact too large', 
        maxSize: '400KB',
        actualSize: `${Math.round(totalSize / 1024)}KB`
      });
    }

    DatabaseService.updateArtifact(
      parseInt(artifactId),
      title,
      files,
      deps || null
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating artifact:', error);
    res.status(500).json({ error: 'Failed to update artifact' });
  }
});

// Получить все артефакты сессии
app.get('/api/sessions/:sessionId/artifacts', (req, res) => {
  try {
    const { sessionId } = req.params;
    const artifacts = DatabaseService.getArtifactsBySession(parseInt(sessionId));
    res.json(artifacts);
  } catch (error) {
    console.error('Error getting artifacts:', error);
    res.status(500).json({ error: 'Failed to get artifacts' });
  }
});

// Веб-поиск через backend (обход CORS ограничений)
app.get('/api/web-search', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const encodedQuery = encodeURIComponent(query);
    const lowerQuery = query.toLowerCase();
    let searchResults = '';

    // 0. Поиск погоды (приоритетный запрос)
    const isWeatherQuery = lowerQuery.includes('погод') || lowerQuery.includes('weather') || 
        lowerQuery.includes('температур') || lowerQuery.includes('temperature') ||
        lowerQuery.includes('метеоролог') || lowerQuery.includes('метео');
    
    if (isWeatherQuery) {
      try {
        // Извлекаем название города из запроса
        // Паттерны: "погода в Москве", "погода Москва", "weather in Moscow"
        let city = 'Moscow'; // По умолчанию Москва
        let cityName = 'Москве'; // Для отображения
        
        // Улучшенное извлечение города
        const patterns = [
          /(?:погод|weather|температур|temperature).*?(?:в|in)\s+([А-Яа-яЁёA-Za-z\s-]+)/i,
          /(?:в|in)\s+([А-Яа-яЁёA-Za-z\s-]+)/i,
          /([А-Яа-яЁё][А-Яа-яЁё\s-]+?)(?:\s|$|,|\.|!|\?)/i
        ];
        
        for (const pattern of patterns) {
          const match = query.match(pattern);
          if (match && match[1]) {
            let extractedCity = match[1].trim();
            // Убираем лишние слова
            extractedCity = extractedCity.replace(/\s+(сегодня|сейчас|завтра|погода|weather|какая|какой)$/i, '').trim();
            
            if (extractedCity.length > 2) {
              cityName = extractedCity;
              
              // Транслитерация русских названий городов
              const cityMap = {
                'москва': 'Moscow',
                'москве': 'Moscow',
                'москвой': 'Moscow',
                'санкт-петербург': 'Saint Petersburg',
                'питер': 'Saint Petersburg',
                'новосибирск': 'Novosibirsk',
                'екатеринбург': 'Yekaterinburg',
                'казань': 'Kazan',
                'нижний новгород': 'Nizhny Novgorod',
                'челябинск': 'Chelyabinsk',
                'самара': 'Samara',
                'омск': 'Omsk',
                'ростов-на-дону': 'Rostov-on-Don',
                'уфа': 'Ufa',
                'красноярск': 'Krasnoyarsk',
                'воронеж': 'Voronezh',
                'пермь': 'Perm',
                'волгоград': 'Volgograd'
              };
              
              const cityLower = extractedCity.toLowerCase();
              if (cityMap[cityLower]) {
                city = cityMap[cityLower];
                break;
              } else if (/^[A-Za-z]/.test(extractedCity)) {
                // Если город на английском, используем как есть
                city = extractedCity;
                break;
              }
            }
          }
        }
        
        console.log('🌤️ Weather query detected, city:', city, 'cityName:', cityName);
        
        // Пробуем несколько источников погоды
        let weatherFound = false;
        
        // 1. Пробуем DuckDuckGo Instant Answer (более надежный)
        try {
          const duckResponse = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(`weather ${city}`)}&format=json&no_redirect=1&no_html=1`, {
            ...(proxyAgent && { dispatcher: proxyAgent }),
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; WindexsAI/1.0)',
              'Accept': 'application/json'
            }
          });
          
          if (duckResponse.ok) {
            const duckData = await duckResponse.json();
            if (duckData.Answer) {
              searchResults += `🌤️ Погода в ${city}:\n${duckData.Answer}\n\n`;
              weatherFound = true;
            }
            if (duckData.AbstractText && !weatherFound) {
              searchResults += `${duckData.AbstractText}\n\n`;
              weatherFound = true;
            }
          }
        } catch (duckError) {
          console.error('DuckDuckGo weather error:', duckError);
        }
        
        // 2. Если DuckDuckGo не дал результатов, пробуем wttr.in
        if (!weatherFound) {
          try {
            // Используем текстовый формат - он более надежный
            const wttrUrl = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%w+%h+%p&lang=ru`;
            const weatherResponse = await fetch(wttrUrl, {
              ...(proxyAgent && { dispatcher: proxyAgent }),
              headers: {
                'User-Agent': 'curl/7.68.0'
              }
            });
            
            if (weatherResponse && weatherResponse.ok) {
              const weatherText = await weatherResponse.text();
              if (weatherText && !weatherText.includes('Sorry') && weatherText.trim().length > 0) {
                // Формат: "Погода Температура Ветер Влажность Давление"
                const parts = weatherText.trim().split(/\s+/);
                if (parts.length >= 2) {
                  searchResults += `🌤️ Погода в ${cityName}:\n\n`;
                  if (parts[0]) searchResults += `☁️ Условия: ${parts[0]}\n`;
                  if (parts[1]) searchResults += `🌡️ Температура: ${parts[1]}\n`;
                  if (parts[2]) searchResults += `💨 Ветер: ${parts[2]}\n`;
                  if (parts[3]) searchResults += `💧 Влажность: ${parts[3]}\n`;
                  if (parts[4]) searchResults += `🌡️ Давление: ${parts[4]}\n\n`;
                  weatherFound = true;
                }
              }
            }
          } catch (wttrError) {
            console.error('wttr.in weather error:', wttrError.message || wttrError);
          }
        }
        
        // Если ничего не найдено, возвращаем базовую информацию
        if (!searchResults || searchResults.trim() === '') {
          // Пробуем получить климатические данные из Wikipedia
          try {
            const wikiQuery = `Климат ${cityName}`;
            const wikiResponse = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`, {
              ...(proxyAgent && { dispatcher: proxyAgent })
            });
            if (wikiResponse.ok) {
              const wikiData = await wikiResponse.json();
              if (wikiData.extract && (wikiData.extract.includes('температур') || wikiData.extract.includes('климат'))) {
                searchResults = `Климатические данные о ${cityName}:\n${wikiData.extract.substring(0, 400)}...\n\n`;
                searchResults += `Для получения актуальной погоды рекомендую проверить специализированные погодные сервисы: Яндекс.Погода, Gismeteo или Weather.com.`;
              } else {
                searchResults = `Для получения актуальной погоды в ${cityName} рекомендую проверить специализированные погодные сервисы, такие как Яндекс.Погода, Gismeteo или Weather.com.`;
              }
            } else {
              searchResults = `Для получения актуальной погоды в ${cityName} рекомендую проверить специализированные погодные сервисы, такие как Яндекс.Погода, Gismeteo или Weather.com.`;
            }
          } catch (wikiError) {
            console.error('Wikipedia fallback error:', wikiError);
            searchResults = `Для получения актуальной погоды в ${cityName} рекомендую проверить специализированные погодные сервисы, такие как Яндекс.Погода, Gismeteo или Weather.com.`;
          }
        }
      } catch (weatherError) {
        console.error('Weather search error:', weatherError);
      }
    }

    // 1. Поиск курсов криптовалют (расширенная логика)
    // Нормализуем запрос для распознавания разных вариантов написания
    const normalizedQuery = lowerQuery.replace(/биткойн/gi, 'биткоин');
    const isCryptoQuery = normalizedQuery.includes('курс') || normalizedQuery.includes('цена') || normalizedQuery.includes('стоимость') ||
        normalizedQuery.includes('крипто') || normalizedQuery.includes('биткоин') || normalizedQuery.includes('ethereum') ||
        normalizedQuery.includes('bitcoin') || normalizedQuery.includes('микро') || /\b(mbc|btc|eth)\b/i.test(normalizedQuery);

    // Поиск курсов криптовалют
    if (isCryptoQuery) {
      try {

        // Известные криптовалюты
        let cryptoIds = [];
        if (normalizedQuery.includes('биткоин') || normalizedQuery.includes('bitcoin') || normalizedQuery.includes('btc') || lowerQuery.includes('btc')) cryptoIds.push('bitcoin');
        if (normalizedQuery.includes('ethereum') || normalizedQuery.includes('эфир') || normalizedQuery.includes('eth') || lowerQuery.includes('eth')) cryptoIds.push('ethereum');

        // Специальные случаи
        if (normalizedQuery.includes('микро') && normalizedQuery.includes('биткоин')) {
          cryptoIds.push('microbitcoin');
        }
        
        // Если запрос содержит "курс" и не указана конкретная криптовалюта, добавляем биткоин по умолчанию
        if (cryptoIds.length === 0 && (normalizedQuery.includes('курс') || normalizedQuery.includes('цена')) && (normalizedQuery.includes('крипто') || normalizedQuery.includes('криптовалют'))) {
          cryptoIds.push('bitcoin');
        }


        if (cryptoIds.length > 0) {
          const cryptoResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds.join(',')}&vs_currencies=usd,rub,eur&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`, {
            ...(proxyAgent && { dispatcher: proxyAgent }),
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; WindexsAI/1.0)',
              'Accept': 'application/json'
            }
          });

          if (cryptoResponse.ok) {
            const cryptoData = await cryptoResponse.json();

            searchResults += `Курсы и данные криптовалют:\n\n`;

            for (const cryptoId of cryptoIds) {
              if (cryptoData[cryptoId]) {
                const data = cryptoData[cryptoId];
                const name = cryptoId.charAt(0).toUpperCase() + cryptoId.slice(1);
                searchResults += `${name}:\n`;
                searchResults += `💰 Цена: $${data.usd} / ₽${data.rub} / €${data.eur}\n`;

                if (data.usd_24h_change !== undefined) {
                  const change = data.usd_24h_change.toFixed(2);
                  const changeIcon = parseFloat(change) >= 0 ? '📈' : '📉';
                  searchResults += `${changeIcon} Изменение 24ч: ${change}%\n`;
                }

                if (data.usd_market_cap) {
                  searchResults += `📊 Капитализация: $${data.usd_market_cap.toLocaleString()}\n`;
                }

                if (data.usd_24h_vol) {
                  searchResults += `📊 Объем 24ч: $${data.usd_24h_vol.toLocaleString()}\n`;
                }

                searchResults += '\n';
              }
            }
          }
        }
      } catch (cryptoError) {
        console.error('Crypto API error:', cryptoError);
      }
    }

    // 2. Все остальные запросы идут через MCP сервер
    if (!searchResults) {
      try {
        console.log('🌐 All searches via MCP server for:', query);
        const mcpResponse = await fetch('https://ai.windexs.ru/api/mcp/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
            max_results: 3 // Ограничиваем количество результатов для экономии места
          })
        });

        if (mcpResponse.ok) {
          const mcpData = await mcpResponse.json();
          console.log('🌐 MCP search successful, results:', mcpData.results ? mcpData.results.length : 0);

          if (mcpData.results && mcpData.results.length > 0) {
            // Ограничиваем длину каждого результата и общее количество
            const maxResultLength = 600; // Максимум 600 символов на результат
            const limitedResults = mcpData.results.slice(0, 3).map((result) => {
              const truncatedContent = result.content && result.content.length > maxResultLength
                ? result.content.substring(0, maxResultLength) + '...'
                : result.content;
              return `${result.title}\n${truncatedContent}`;
            });

            searchResults = limitedResults.join('\n\n');

            // Если есть summary/answer от MCP, добавляем его
            if (mcpData.answer && mcpData.answer.trim()) {
              searchResults = `${mcpData.answer}\n\nИсточники:\n${searchResults}`;
            }
          } else {
            searchResults = 'Информация не найдена.';
          }
        } else {
          const errorText = await mcpResponse.text();
          console.error('❌ MCP search failed:', mcpResponse.status, errorText);
          searchResults = 'Ошибка при поиске информации.';
        }
      } catch (mcpError) {
        console.error('MCP search error:', mcpError);
        searchResults = 'Ошибка подключения к поисковой системе.';
      }
    }

    // 3. Поиск в Wikipedia
    try {
      const wikiQuery = query.replace(/\s+/g, '_');

      // Сначала пробуем русский
      let wikiResponse = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`, {
        ...(proxyAgent && { dispatcher: proxyAgent })
      });
      if (!wikiResponse.ok) {
        // Если русский не найден, пробуем английский
        wikiResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`, {
          ...(proxyAgent && { dispatcher: proxyAgent })
        });
      }

      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        if (wikiData.extract) {
          searchResults += `Из Wikipedia: ${wikiData.extract}\n\n`;
          if (wikiData.description) {
            searchResults += `Описание: ${wikiData.description}\n\n`;
          }
        }
      }
    } catch (wikiError) {
      console.error('Wikipedia search error:', wikiError);
    }


    // Возвращаем результаты или сообщение об отсутствии результатов
    const finalResult = searchResults || '[NO_RESULTS_FOUND]';

    res.json({
      query,
      results: finalResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Web search API error:', error);
    res.status(500).json({
      error: 'Failed to perform web search',
      details: error.message
    });
  }
});

// MCP server proxy for web search
app.post('/api/mcp/search', async (req, res) => {
  try {
    console.log('🔍 MCP search proxy request:', req.body?.query);

    const fetch = (await import('node-fetch')).default;

      const mcpResponse = await fetch('https://ai.windexs.ru/api/mcp/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP server error: ${mcpResponse.status}`);
    }

    const data = await mcpResponse.json();
    res.json(data);

  } catch (error) {
    console.error('❌ MCP proxy error:', error);
    res.status(500).json({
      error: 'MCP search failed',
      details: error.message
    });
  }
});

// OpenAI Chat API proxy (обход CORS ограничений)
app.post('/api/chat', async (req, res) => {
  try {
    console.log('🔥 API /chat request received:', req.body?.messages?.[req.body.messages.length - 1]?.content);
    const { messages, model = 'gpt-4o-mini', stream = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Проверяем на market query и добавляем данные
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    let enhancedMessages = messages;

    if (lastUserMessage && isMarketQuery(lastUserMessage.content)) {
      console.log('📊 Server: Market query detected, adding market data to context');
      const marketSnapshot = await getMarketSnapshot();

      // Добавляем market данные в системное сообщение или создаем новое
      const systemMessageIndex = messages.findIndex(m => m.role === 'system');
      if (systemMessageIndex >= 0) {
        // Добавляем к существующему системному сообщению
        enhancedMessages = [...messages];
        enhancedMessages[systemMessageIndex].content += `\n\nАКТУАЛЬНЫЕ ДАННЫЕ ПО BITCOIN:\n${marketSnapshot}`;
      } else {
        // Создаем новое системное сообщение
        enhancedMessages = [
          {
            role: 'system',
            content: `Ты полезный AI-ассистент. Используй предоставленные актуальные данные по Bitcoin для ответа на вопросы пользователя.\n\nАКТУАЛЬНЫЕ ДАННЫЕ ПО BITCOIN:\n${marketSnapshot}`
          },
          ...messages
        ];
      }
    }

    // Получаем API ключ из переменных окружения сервера
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured on server' });
    }

    // Для GPT-5.1 используем GPT-4o как fallback, поскольку GPT-5.1 может быть недоступен
    const actualModel = (model === 'gpt-5.1' || model.startsWith('gpt-5')) ? 'gpt-4o-mini' : model;

    console.log('🎯 Using model:', actualModel, '(requested:', model, ')');

    // GPT-5.1 не поддерживает streaming, поэтому всегда используем stream: false для него
    const actualStream = (model === 'gpt-5.1' || model.startsWith('gpt-5')) ? false : stream;

    // Все модели используют Chat Completions API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      ...(proxyAgent && { dispatcher: proxyAgent }),
      body: JSON.stringify({
        model: actualModel,
        messages: enhancedMessages,
        stream: actualStream,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      return res.status(openaiResponse.status).json({
        error: 'OpenAI API error',
        details: errorText
      });
    }

    if (stream) {
      // Для потоковых ответов передаем поток напрямую
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = openaiResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          res.write(chunk);
        }
      } finally {
        res.end();
      }
    } else {
      // Для обычных ответов возвращаем JSON
      const data = await openaiResponse.json();

      // Добавляем расчет стоимости токенов
      if (data.usage) {
        const prices = getTokenPrices(actualModel);
        const inputTokens = data.usage.prompt_tokens || 0;
        const outputTokens = data.usage.completion_tokens || 0;
        const totalTokens = data.usage.total_tokens || (inputTokens + outputTokens);

        const inputCost = (inputTokens / 1000000) * prices.input;
        const outputCost = (outputTokens / 1000000) * prices.output;
        const totalCost = inputCost + outputCost;

        data.tokenCost = {
          inputTokens,
          outputTokens,
          totalTokens,
          inputCost,
          outputCost,
          totalCost,
          model: actualModel,
          currency: 'USD'
        };
      }

      // Возвращаем ответ в стандартном формате
      res.json(data);
    }

  } catch (error) {
    console.error('Chat API proxy error:', error);
    res.status(500).json({
      error: 'Failed to process chat request',
      details: error.message
    });
  }
});

// OpenAI TTS API proxy
app.post('/api/tts', async (req, res) => {
  try {
    const { input, model = 'tts-1', voice = 'alloy', speed = 1.0 } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured on server' });
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      ...(proxyAgent && { dispatcher: proxyAgent }),
      body: JSON.stringify({
        model,
        input,
        voice,
        response_format: 'mp3',
        speed,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI TTS API error:', openaiResponse.status, errorText);
      return res.status(openaiResponse.status).json({
        error: 'OpenAI API error',
        details: errorText
      });
    }

    // Передаем аудио поток напрямую клиенту
    const audioBuffer = await openaiResponse.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS API proxy error:', error);
    res.status(500).json({
      error: 'Failed to process TTS request',
      details: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint for context checking
app.post('/api/test-context', (req, res) => {
  const { messages } = req.body;
  console.log('🧪 Test context endpoint called');
  console.log('📜 Received messages:', messages?.length || 0);
  if (messages) {
    messages.forEach((msg, i) => {
      console.log(`  ${i}: ${msg.role} - ${msg.content?.substring(0, 100)}${msg.content?.length > 100 ? '...' : ''}`);
    });
  }
  res.json({
    status: 'ok',
    messageCount: messages?.length || 0,
    messages: messages
  });
});

// Test market query detection
app.post('/api/test-market-query', (req, res) => {
  const { query } = req.body;
  const lowerQuery = query.toLowerCase();

  // Проверяем на упоминание биткойна в различных формах
  const hasBitcoin = lowerQuery.includes('биткойн') ||
                     lowerQuery.includes('биткоин') ||
                     lowerQuery.includes('bitcoin') ||
                     lowerQuery.includes('btc');

  // Проверяем на слова, указывающие на запрос цены/курса
  const hasPriceQuery = lowerQuery.includes('курс') ||
                       lowerQuery.includes('цена') ||
                       lowerQuery.includes('стоимость') ||
                       lowerQuery.includes('стоит') ||
                       lowerQuery.includes('сколько') ||
                       lowerQuery.includes('rate') ||
                       lowerQuery.includes('price') ||
                       lowerQuery.includes('cost');

  const isMarketQuery = hasBitcoin && hasPriceQuery;

  console.log('🧪 Market query test:', { query, hasBitcoin, hasPriceQuery, isMarketQuery });

  res.json({
    query,
    hasBitcoin,
    hasPriceQuery,
    isMarketQuery
  });
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - all non-API routes should return index.html
app.use((req, res, next) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // For all other routes, serve index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on https://ai.windexs.ru`);
  console.log(`📦 Serving static files from dist/`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down API server...');
  DatabaseService.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down API server...');
  DatabaseService.close();
  process.exit(0);
});
