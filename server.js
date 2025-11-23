import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ProxyAgent } from 'undici';
import { DatabaseService } from './src/lib/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 1062;

// Настройка прокси для Undici (встроенный fetch в Node.js)
const PROXY_URL = process.env.PROXY_URL;
const proxyAgent = PROXY_URL ? new ProxyAgent({
  uri: PROXY_URL
}) : null;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083', 'http://localhost:3000', 'http://localhost:1062', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082', 'http://127.0.0.1:8083', 'http://127.0.0.1:3000', 'http://127.0.0.1:1062', 'https://ai.windexs.ru', 'https://www.ai.windexs.ru', 'http://ai.windexs.ru', 'http://www.ai.windexs.ru'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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
    const { sessionId, role, content } = req.body;

    if (!sessionId || !role || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const messageId = DatabaseService.saveMessage(sessionId, role, content);
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
        const mcpResponse = await fetch('http://localhost:8002/search', {
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

    const mcpResponse = await fetch('http://localhost:8002/search', {
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
        messages,
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
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
