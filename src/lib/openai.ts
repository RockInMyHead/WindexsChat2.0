import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true, // Note: This is for client-side usage, in production you'd want a backend proxy
});

// Функция для проверки доступности API
const isApiAvailable = () => {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
};

// Функция для поиска в интернете через backend API (обход CORS)
const searchWeb = async (query: string): Promise<string> => {
  try {
    // Используем backend endpoint для поиска, который обходит CORS ограничения
    const searchResponse = await fetch(`${API_BASE_URL.replace('/api', '')}/web-search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      console.error('Backend search API error:', searchResponse.status, searchResponse.statusText);
      // Fallback к старому методу если backend недоступен
      return await searchWebFallback(query);
    }

    const searchData = await searchResponse.json();
    console.log('Backend search results for:', query, searchData);

    return searchData.results || '[NO_RESULTS_FOUND]';

  } catch (error) {
    console.error('Backend search error:', error);
    // Fallback к старому методу при ошибке
    return await searchWebFallback(query);
  }
};

// Fallback функция для поиска (старый метод для случаев когда backend недоступен)
const searchWebFallback = async (query: string): Promise<string> => {
  try {
    const encodedQuery = encodeURIComponent(query);
    const lowerQuery = query.toLowerCase();

    let searchResults = '';

    // 1. Специальная обработка для запросов о курсах криптовалют
    if (lowerQuery.includes('курс') && (lowerQuery.includes('биткоин') || lowerQuery.includes('крипто') || lowerQuery.includes('bitcoin') || lowerQuery.includes('ethereum'))) {
      try {
        const cryptoIds = [];
        if (lowerQuery.includes('биткоин') || lowerQuery.includes('bitcoin')) cryptoIds.push('bitcoin');
        if (lowerQuery.includes('ethereum') || lowerQuery.includes('эфир')) cryptoIds.push('ethereum');

        if (cryptoIds.length > 0) {
          const cryptoResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds.join(',')}&vs_currencies=usd,rub,eur`);
          if (cryptoResponse.ok) {
            const cryptoData = await cryptoResponse.json();
            searchResults += `Курсы криптовалют:\n`;
            if (cryptoData.bitcoin) {
              searchResults += `Bitcoin:\n`;
              searchResults += `- USD: $${cryptoData.bitcoin.usd}\n`;
              searchResults += `- RUB: ₽${cryptoData.bitcoin.rub}\n`;
              searchResults += `- EUR: €${cryptoData.bitcoin.eur}\n\n`;
            }
            if (cryptoData.ethereum) {
              searchResults += `Ethereum:\n`;
              searchResults += `- USD: $${cryptoData.ethereum.usd}\n`;
              searchResults += `- RUB: ₽${cryptoData.ethereum.rub}\n`;
              searchResults += `- EUR: €${cryptoData.ethereum.eur}\n\n`;
            }
          }
        }
      } catch (cryptoError) {
        console.error('Crypto API error:', cryptoError);
      }
    }

    // 2. Поиск новостей и актуальной информации
    if (lowerQuery.includes('новост') || lowerQuery.includes('событи') || lowerQuery.includes('происшеств')) {
      try {
        const newsResponse = await fetch(`https://newsapi.org/v2/everything?q=${encodedQuery}&language=ru&sortBy=publishedAt&pageSize=3&apiKey=demo`);
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          if (newsData.articles && newsData.articles.length > 0) {
            searchResults += `Последние новости:\n`;
            newsData.articles.forEach((article: any, index: number) => {
              searchResults += `${index + 1}. ${article.title}\n`;
              searchResults += `   ${article.description || 'Описание недоступно'}\n`;
              searchResults += `   Источник: ${article.source.name}\n\n`;
            });
          }
        }
      } catch (newsError) {
        console.error('News API error:', newsError);
      }
    }

    // Пробуем разные вариации запроса
    const queryVariations = [
      query, // оригинальный запрос
      query.replace('микро', 'micro'), // заменяем "микро" на "micro"
      query.replace(/что такое\s+/i, ''), // убираем "что такое"
      query.replace(/что\s+такое\s+/i, ''), // убираем "что такое"
    ].filter((q, index, arr) => arr.indexOf(q) === index); // убираем дубликаты

    for (const searchQuery of queryVariations) {
      if (searchResults) break; // Если уже нашли результаты, не ищем дальше

      const variationEncoded = encodeURIComponent(searchQuery);

      // Пробуем DuckDuckGo Instant Answer
      const ddgoResponse = await fetch(`https://api.duckduckgo.com/?q=${variationEncoded}&format=json&no_html=1&skip_disambig=1`);

      if (ddgoResponse.ok) {
        const data = await ddgoResponse.json();
        console.log(`DuckDuckGo Instant Answer results for "${searchQuery}":`, data);

        // Answer (прямой ответ)
        if (data.Answer) {
          searchResults += `Ответ: ${data.Answer}\n\n`;
        }

        // AbstractText (краткое описание)
        if (data.AbstractText) {
          searchResults += `Описание: ${data.AbstractText}\n\n`;
        }

        // Definition (определение)
        if (data.Definition) {
          searchResults += `Определение: ${data.Definition}\n\n`;
        }

        // AbstractURL (ссылка на источник)
        if (data.AbstractURL) {
          searchResults += `Источник: ${data.AbstractURL}\n\n`;
        }

        // Heading (заголовок)
        if (data.Heading) {
          searchResults += `Тема: ${data.Heading}\n\n`;
        }
      }

      // Если все еще нет результатов, пробуем обычный DuckDuckGo поиск
      if (!searchResults) {
        const searchResponse = await fetch(`https://api.duckduckgo.com/?q=${variationEncoded}&format=json`);
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log(`DuckDuckGo general search results for "${searchQuery}":`, searchData);

          if (searchData.Answer) {
            searchResults += `Ответ: ${searchData.Answer}\n\n`;
          }

          if (searchData.AbstractText) {
            searchResults += `Информация: ${searchData.AbstractText}\n\n`;
          }

          if (searchData.Definition) {
            searchResults += `Определение: ${searchData.Definition}\n\n`;
          }

          if (searchData.Heading) {
            searchResults += `Тема: ${searchData.Heading}\n\n`;
          }

          // RelatedTopics - связанные темы
          if (searchData.RelatedTopics && Array.isArray(searchData.RelatedTopics)) {
            const topics = searchData.RelatedTopics.slice(0, 3);
            if (topics.length > 0) {
              searchResults += 'Связанная информация:\n';
              topics.forEach((topic: any, index: number) => {
                if (topic.Text && topic.Text.length > 10) { // Фильтруем слишком короткие результаты
                  searchResults += `${index + 1}. ${topic.Text}\n`;
                }
              });
              searchResults += '\n';
            }
          }
        }
      }
    }

    // 4. Поиск в Wikipedia (русский и английский)
    if (!searchResults) {
      try {
        const wikiQuery = query.replace(/\s+/g, '_');

        // Пробуем русский вариант сначала
        let wikiResponse = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`);

        // Если русский не найден, пробуем английский
        if (!wikiResponse.ok) {
          wikiResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`);
        }

        if (wikiResponse.ok) {
          const wikiData = await wikiResponse.json();
          console.log('Wikipedia search results for:', query, wikiData);

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
    }

    // 5. Поиск определений через словари
    if (!searchResults && (lowerQuery.includes('что такое') || lowerQuery.includes('определение'))) {
      try {
        // Пробуем Glosbe API для определений
        const term = query.replace(/что такое\s+/i, '').replace(/определение\s+/i, '').trim();
        const glosbeResponse = await fetch(`https://glosbe.com/gapi/translate?from=ru&dest=en&format=json&phrase=${encodeURIComponent(term)}`);

        if (glosbeResponse.ok) {
          const glosbeData = await glosbeResponse.json();
          console.log('Glosbe dictionary results for:', term, glosbeData);

          if (glosbeData.tuc && glosbeData.tuc.length > 0) {
            searchResults += `Определения и переводы:\n`;
            glosbeData.tuc.slice(0, 3).forEach((entry: any, index: number) => {
              if (entry.meanings && entry.meanings.length > 0) {
                entry.meanings.slice(0, 2).forEach((meaning: any) => {
                  if (meaning.text) {
                    searchResults += `${index + 1}. ${meaning.text}\n`;
                  }
                });
              }
            });
            searchResults += '\n';
          }
        }
      } catch (dictError) {
        console.error('Dictionary search error:', dictError);
      }
    }

    // 6. Дополнительные источники (Stack Exchange для технических вопросов)
    if (!searchResults) {
      try {
        // Для технических вопросов пробуем Stack Exchange API
        if (lowerQuery.includes('как') || lowerQuery.includes('почему') || lowerQuery.includes('ошибк') || lowerQuery.includes('программировани')) {
          const stackResponse = await fetch(`https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&tagged=javascript&intitle=${encodedQuery}&site=stackoverflow`);

          if (stackResponse.ok) {
            const stackData = await stackResponse.json();
            console.log('Stack Overflow search results for:', query, stackData);

            if (stackData.items && stackData.items.length > 0) {
              searchResults += `Из Stack Overflow:\n`;
              stackData.items.slice(0, 2).forEach((item: any, index: number) => {
                if (item.title) {
                  searchResults += `${index + 1}. ${item.title}\n`;
                  if (item.tags && item.tags.length > 0) {
                    searchResults += `   Теги: ${item.tags.slice(0, 3).join(', ')}\n`;
                  }
                  searchResults += `   Ссылка: https://stackoverflow.com/questions/${item.question_id}\n\n`;
                }
              });
            }
          }
        }
      } catch (stackError) {
        console.error('Stack Exchange search error:', stackError);
      }
    }


    // Если результатов нет, возвращаем специальный маркер
    const finalResult = searchResults || '[NO_RESULTS_FOUND]';

    console.log('Final search result:', finalResult);
    return finalResult;
  } catch (error) {
    console.error('Web search error:', error);
    return `Не удалось выполнить поиск в интернете из-за технической ошибки: ${error}. Использую доступные знания AI.`;
  }
};

// Функция определения необходимости веб-поиска (расширенная логика)
const requiresWebSearch = (query: string): boolean => {
  const lowerQuery = query.toLowerCase();

  // ВИЗУАЛИЗАЦИИ: всегда требуют поиска актуальных данных
  if (lowerQuery.includes('визуализ') || lowerQuery.includes('покажи график') ||
      lowerQuery.includes('данные для график') || lowerQuery.includes('график') ||
      lowerQuery.includes('диаграмм') || lowerQuery.includes('создать визуализацию')) {
    return true;
  }

  // Актуальные данные и время
  if (lowerQuery.includes('сейчас') || lowerQuery.includes('сегодня') || lowerQuery.includes('вчера') ||
      lowerQuery.includes('последн') || lowerQuery.includes('актуальн') || lowerQuery.includes('текущ')) {
    return true;
  }

  // Финансовые данные
  if (lowerQuery.includes('курс') || lowerQuery.includes('цена') || lowerQuery.includes('стоимост') ||
      lowerQuery.includes('биткоин') || lowerQuery.includes('крипто') || lowerQuery.includes('валют') ||
      lowerQuery.includes('бирж') || lowerQuery.includes('инфляц') ||
      /\b(mbc|btc|eth|bnb|ada|sol|dot|avax|matic|link|uni|usdc|usdt)\b/i.test(lowerQuery)) {
    return true;
  }

  // Статистика и аналитика
  if (lowerQuery.includes('рейтинг') || lowerQuery.includes('топ') || lowerQuery.includes('данн') ||
      lowerQuery.includes('отчет') || lowerQuery.includes('статистик') || lowerQuery.includes('исследован') ||
      lowerQuery.includes('процент') || lowerQuery.includes('рост') || lowerQuery.includes('паден')) {
    return true;
  }

  // Тренды и популярность
  if (lowerQuery.includes('популярн') || lowerQuery.includes('мод') || lowerQuery.includes('тренд') ||
      lowerQuery.includes('хит') || lowerQuery.includes('бестселлер')) {
    return true;
  }

  // Новости и события
  if (lowerQuery.includes('новост') || lowerQuery.includes('событи') || lowerQuery.includes('происшеств') ||
      lowerQuery.includes('анонс') || lowerQuery.includes('мероприят') || lowerQuery.includes('конференц')) {
    return true;
  }

  // Поисковые запросы
  if (lowerQuery.includes('что такое') || lowerQuery.includes('определен') || lowerQuery.includes('значен') ||
      lowerQuery.includes('кто такой') || lowerQuery.includes('где наход')) {
    return true;
  }

  // Технические запросы
  if (lowerQuery.includes('как сделат') || lowerQuery.includes('инструкц') || lowerQuery.includes('туториал') ||
      lowerQuery.includes('документац') || lowerQuery.includes('справочник')) {
    return true;
  }

  // Погода и география
  if (lowerQuery.includes('погод') || lowerQuery.includes('температур') || lowerQuery.includes('климат') ||
      lowerQuery.includes('расписан') || lowerQuery.includes('график') || lowerQuery.includes('координат')) {
    return true;
  }

  // Запросы на визуализацию данных - ВСЕГДА требуют поиска реальных данных
  if (lowerQuery.includes('визуализ') || lowerQuery.includes('покажи график') ||
      lowerQuery.includes('данные') && (lowerQuery.includes('график') || lowerQuery.includes('диаграмм'))) {
    return true; // Всегда искать реальные данные для визуализации
  }

  // Сложные запросы (более 4 слов или с вопросительными словами)
  const questionWords = ['кто', 'что', 'где', 'когда', 'почему', 'как', 'какой', 'сколько'];
  if (query.split(' ').length > 4 || questionWords.some(word => lowerQuery.includes(word))) {
    return true;
  }

  // Специфические термины, которые могут требовать поиска
  const specificTerms = ['ai', 'искусственный интеллект', 'нейросеть', 'блокчейн', 'криптовалют',
                         'технолог', 'инновац', 'стартап', 'компани', 'корпорац'];
  if (specificTerms.some(term => lowerQuery.includes(term))) {
    return true;
  }

  // Определяем сложные запросы (исключая простые)
  const isComplexQuery = (() => {
    // Длина запроса (>50 символов считается сложным)
    if (query.length > 50) return true;

    // Наличие вопросительных слов
    const questionWords = ['что', 'как', 'почему', 'зачем', 'где', 'когда', 'кто', 'какой', 'какая', 'какие', 'какое'];
    const hasQuestionWord = questionWords.some(word => lowerQuery.includes(word));

    // Наличие сложных конструкций
    const complexPatterns = [
      /\bсколько\b/,
      /\bгде\b.*\bнаходится\b/,
      /\bкак\b.*\bработает\b/,
      /\bчто\b.*\bтакое\b/,
      /\bкакие\b.*\bлучшие\b/,
      /\bкакой\b.*\bсамый\b/,
      /\bпочему\b.*\bпроисходит\b/,
      /\bкто\b.*\bсоздал\b/
    ];
    const hasComplexPattern = complexPatterns.some(pattern => pattern.test(lowerQuery));

    // Количество слов (>7 слов считается сложным)
    const wordCount = query.split(/\s+/).length;
    const hasManyWords = wordCount > 7;

    return hasQuestionWord || hasComplexPattern || hasManyWords;
  })();

  // Исключаем очень простые запросы
  const simpleQueries = [
    'привет', 'здравствуй', 'спасибо', 'пока', 'до свидания',
    'да', 'нет', 'хорошо', 'плохо', 'нормально',
    'ок', 'окей', 'ладно', 'понятно', 'ясно'
  ];

  const isSimpleQuery = simpleQueries.some(simple =>
    lowerQuery.trim() === simple ||
    lowerQuery.trim().startsWith(simple + ' ') ||
    lowerQuery.trim().endsWith(' ' + simple) ||
    lowerQuery.trim().includes(' ' + simple + ' ')
  );

  // Исключаем запросы на создание контента
  const contentCreationKeywords = [
    'напиши', 'создай', 'разработай', 'придумай', 'предложи',
    'составь', 'опиши', 'расскажи', 'продолжи'
  ];

  const isContentCreation = contentCreationKeywords.some(keyword =>
    lowerQuery.includes(keyword)
  );

  // Возвращаем true если:
  // 1. Запрос сложный И НЕ простой И НЕ на создание контента
  return (isComplexQuery && !isSimpleQuery) && !isContentCreation;
};

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface PlanStep {
  step: string;
  description: string;
  completed: boolean;
}

export const sendChatMessage = async (
  messages: Message[],
  model: string = "gpt-3.5-turbo",
  onChunk?: (chunk: string) => void,
  onPlanGenerated?: (plan: PlanStep[]) => void,
  onStepStart?: (stepIndex: number, step: PlanStep) => void
): Promise<string> => {
  try {
    // Проверяем доступность API
    if (!isApiAvailable()) {
      return "Извините, сервис AI временно недоступен. Пожалуйста, проверьте настройки API ключа.";
    }
    const userMessage = messages[messages.length - 1];
    const isFirstResponse = messages.filter(m => m.role === 'assistant').length === 0;

    let fullResponse = '';

    if (isFirstResponse && userMessage.role === 'user') {
      // Проверяем тип запроса
      const lowerQuery = userMessage.content.toLowerCase();
      const isContentCreation = ['напиши', 'создай', 'разработай', 'придумай', 'предложи', 'составь', 'опиши', 'расскажи', 'продолжи'].some(keyword =>
        lowerQuery.includes(keyword)
      );

      let plan: PlanStep[] = [];
      let searchResults = '';

      // Всегда генерируем план для сложных запросов
      const isSimpleQuery = ['привет', 'здравствуй', 'спасибо', 'пока', 'до свидания', 'да', 'нет', 'хорошо', 'плохо', 'нормально', 'ок', 'окей', 'ладно', 'понятно', 'ясно'].some(simple =>
        lowerQuery.trim() === simple ||
        lowerQuery.trim().startsWith(simple + ' ') ||
        lowerQuery.trim().endsWith(' ' + simple) ||
        lowerQuery.trim().includes(' ' + simple + ' ')
      );

      // Генерируем план для всех не-простых запросов
      if (!isSimpleQuery) {
        plan = await generateResponsePlan(userMessage.content, model);
      }

      // Проверяем, требуется ли поиск в интернете
      // Для запросов на визуализацию поиск ВСЕГДА нужен (даже если это content creation)
      const isVisualizationRequest = lowerQuery.includes('визуализ') || lowerQuery.includes('покажи график') ||
        (lowerQuery.includes('данные') && (lowerQuery.includes('график') || lowerQuery.includes('диаграмм')));

      if (!isContentCreation || isVisualizationRequest) {
        const needsWebSearch = requiresWebSearch(userMessage.content);

        if (needsWebSearch) {
          console.log('Web search required for:', userMessage.content);
          console.log('Query analysis:', {
            hasSearchKeyword: ['актуальн', 'сейчас', 'последн', 'новост', 'сегодня', 'время', 'курс', 'цена', 'стоимост', 'рейтинг', 'топ', 'лучш', 'статистик', 'данн', 'отчет', 'тренд', 'мод', 'популярн', 'событи', 'происшестви', 'изменени', 'обновлени', 'нов', 'текущ', 'свеж', 'последн', 'настоящ'].some(keyword => userMessage.content.toLowerCase().includes(keyword)),
            isComplex: userMessage.content.length > 50 || userMessage.content.split(/\s+/).length > 7 || ['что', 'как', 'почему', 'зачем', 'где', 'когда', 'кто', 'какой', 'какая', 'какие', 'какое'].some(word => userMessage.content.toLowerCase().includes(word)),
            isSimple: isSimpleQuery,
            isContentCreation: isContentCreation,
            isVisualizationRequest: isVisualizationRequest
          });
          searchResults = await searchWeb(userMessage.content);
          console.log('Search completed, results:', searchResults.substring(0, 200) + '...');
        }
      }

      if (onPlanGenerated) {
        onPlanGenerated(plan);
      }

      // Выполняем план поэтапно только если план не пустой
      if (plan.length > 0) {
        for (let i = 0; i < plan.length; i++) {
          const step = plan[i];

          if (onStepStart) {
            onStepStart(i, step);
          }

          // Генерируем контент для этого этапа
          const searchContext = searchResults && searchResults !== '[NO_RESULTS_FOUND]' && !searchResults.includes('технической ошибки')
            ? `Результаты поиска в интернете:\n${searchResults}\n\n`
            : '';

          console.log('Plan step - searchContext:', searchContext ? 'HAS_CONTEXT' : 'NO_CONTEXT');
          console.log('Plan step - searchResults:', searchResults);

          // Для изоляции контекста используем только системное сообщение + текущее задание
          const systemMessage = messages.find(msg => msg.role === 'system') || {
            role: 'system' as const,
            content: 'Ты полезный AI-ассистент. Каждый чат является полностью независимым и изолированным. Не используй информацию или контекст из других разговоров. Отвечай только на основе предоставленных сообщений в текущем чате.'
          };
          const stepMessages = [
            systemMessage,
            {
              role: 'user' as const,
              content: `${searchContext}Выполни этап плана "${step.step}": ${step.description}. Предыдущий контекст выполнения плана: ${fullResponse}`
            }
          ];

          const stepResponse = await executePlanStep(stepMessages, model, (chunk) => {
            if (onChunk) {
              onChunk(chunk);
            }
          });

          fullResponse += stepResponse + '\n\n';

          // Отмечаем этап как завершенный
          plan[i].completed = true;
        }
      } else {
        // Обычный ответ без плана (для простых запросов)
        const searchContext = searchResults && searchResults !== '[NO_RESULTS_FOUND]' && !searchResults.includes('технической ошибки')
          ? `Результаты поиска в интернете:\n${searchResults}\n\n`
          : '';

        console.log('Simple query - searchContext:', searchContext ? 'HAS_CONTEXT' : 'NO_CONTEXT');
        console.log('Simple query - searchResults:', searchResults);

        // Для изоляции контекста используем только системное сообщение + текущий запрос
        const systemMessage = messages.find(msg => msg.role === 'system');
        const enhancedMessages = searchContext ? [
          systemMessage || { role: 'system' as const, content: 'Ты полезный AI-ассистент.' },
          {
            role: 'user' as const,
            content: `${searchContext}${userMessage.content}`
          }
        ] : [
          systemMessage || {
            role: 'system' as const,
            content: 'Ты полезный AI-ассистент. Каждый чат является полностью независимым и изолированным. Не используй информацию или контекст из других разговоров. Отвечай только на основе предоставленных сообщений в текущем чате.'
          },
          userMessage
        ];

        const response = await openai.chat.completions.create({
          model: model === "pro" ? "gpt-4" : "gpt-3.5-turbo",
          messages: enhancedMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: true,
        });

        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            if (onChunk) {
              onChunk(content);
            }
          }
        }
      }
    } else {
      // Обычный ответ без плана (для последующих сообщений)
      const response = await openai.chat.completions.create({
        model: model === "pro" ? "gpt-4" : "gpt-3.5-turbo",
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: true,
      });

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          if (onChunk) {
            onChunk(content);
          }
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
};

// Генерация плана ответа
const generateResponsePlan = async (userQuestion: string, model: string): Promise<PlanStep[]> => {
  // Проверяем доступность API
  if (!isApiAvailable()) {
    return []; // Возвращаем пустой план при недоступности API
  }

  const planPrompt = `
Проанализируй вопрос пользователя и создай подробный, структурированный план ответа. Раздели сложные задачи на логические этапы.

Вопрос пользователя: "${userQuestion}"

СПЕЦИАЛЬНЫЕ СЛУЧАИ:
- Если запрос содержит "визуализируй", "покажи график" или "данные для графика" - это запрос на визуализацию. Создай план с этапами поиска реальных статистических данных в интернете, их анализа и создания визуализации.
- ВАЖНО: При создании визуализации НЕ включай JSON код в текст ответа. JSON должен генерироваться отдельно для автоматического распознавания системой визуализации.
- Для запросов о данных бизнеса/финансов (прибыль, продажи, рынок, кофе, недвижимость) - включи этапы: поиск конкретных цифр и статистических данных, извлечение числовых показателей из найденной информации, анализ трендов.
- КРИТИЧНО: Анализируй результаты поиска и извлекай ВСЕ найденные числовые данные (суммы в рублях, проценты, количества). Не используй плейсхолдеры XXXX - используй реальные цифры из поиска или создавай обоснованные оценки на их основе.
- Структура ответа: сначала анализ найденных данных с конкретными цифрами, затем система автоматически создаст визуализацию из JSON данных.
- ДЛЯ ВИЗУАЛИЗАЦИЙ: Всегда включай этап "Анализ найденных данных и подготовка визуализации" где AI должен использовать реальные данные из поиска.

ОПРЕДЕЛИ ТИП ЗАДАЧИ:
- Если это простой вопрос (приветствие, погода, факты) - создай 1-2 этапа
- Если это анализ, исследование или планирование - создай 4-8 детальных этапов
- Если это творческая задача (написание, дизайн) - создай 3-6 этапов
- Если это бизнес-задача (план, стратегия, анализ рынка) - создай 5-10 этапов
- Если это визуализация данных - создай 3-5 этапов: анализ требований, генерация данных, создание визуализации

Для бизнес-плана кофейни включи следующие разделы:
1. Анализ рынка и конкурентов
2. Целевая аудитория и концепция
3. Финансовый план и бюджетирование
4. Маркетинг и продвижение
5. Операционный план
6. Риски и их минимизация

Каждый этап должен:
1. Иметь четкое, конкретное название
2. Содержать подробное описание действий
3. Быть логически связанным с предыдущими этапами
4. Быть реалистичным для выполнения
5. Если вопрос касается данных/статистики - добавить этап визуализации

Верни план в формате JSON:
[
  {
    "step": "Краткое название этапа",
    "description": "Подробное описание что делать на этом этапе, включая конкретные действия и ожидаемые результаты",
    "completed": false
  }
]

План должен быть практичным, реалистичным и помогать дать полный, профессиональный ответ.
`;

  const response = await openai.chat.completions.create({
    model: model === "pro" ? "gpt-4" : "gpt-3.5-turbo",
    messages: [
      { role: 'system', content: 'Ты - помощник, который создает планы ответов. Всегда отвечай только в формате JSON.' },
      { role: 'user', content: planPrompt }
    ],
    temperature: 0.7,
  });

  const planText = response.choices[0]?.message?.content || '[]';

  try {
    // Очищаем текст от возможных обратных кавычек и лишних символов
    let cleanText = planText.trim();

    // Удаляем обратные кавычки если они есть
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/```\s*/, '').replace(/```\s*$/, '');
    }

    // Удаляем возможные текстовые префиксы
    if (cleanText.includes('[') && cleanText.includes(']')) {
      const startIndex = cleanText.indexOf('[');
      const endIndex = cleanText.lastIndexOf(']') + 1;
      cleanText = cleanText.substring(startIndex, endIndex);
    }

    const plan = JSON.parse(cleanText);
    return Array.isArray(plan) ? plan : [];
  } catch (error) {
    console.error('Error parsing plan JSON:', error);
    console.error('Original plan text:', planText);

    // Для простых запросов возвращаем пустой план, чтобы использовать обычный ответ
    const isSimpleQuery = userQuestion.length < 100 &&
      !userQuestion.toLowerCase().includes('план') &&
      !userQuestion.toLowerCase().includes('анализ') &&
      !userQuestion.toLowerCase().includes('разработ') &&
      !userQuestion.toLowerCase().includes('созда');

    if (isSimpleQuery) {
      return []; // Пустой план = обычный ответ без этапов
    }

    // Возвращаем дефолтный план для сложных запросов
    return [
      {
        step: "Анализ вопроса",
        description: "Проанализировать и понять суть вопроса пользователя",
        completed: false
      },
      {
        step: "Подготовка ответа",
        description: "Собрать необходимую информацию для ответа",
        completed: false
      },
      {
        step: "Формулировка ответа",
        description: "Сформулировать полный и понятный ответ",
        completed: false
      }
    ];
  }
};

// Выполнение одного этапа плана
const executePlanStep = async (
  messages: Message[],
  model: string,
  onChunk?: (chunk: string) => void
): Promise<string> => {
  const stepMessage = messages[messages.length - 1];
  const stepContent = stepMessage.content.toLowerCase();

  // Проверяем, является ли это этапом создания визуализации
  const isVisualizationStep = stepContent.includes('визуализац') ||
                             stepContent.includes('график') ||
                             stepContent.includes('диаграмм') ||
                             stepContent.includes('создать визуализацию');

  // Определяем тип бизнес-этапа для более точных инструкций
  const isMarketAnalysis = stepContent.includes('анализ рынка') || stepContent.includes('конкурент');
  const isFinancialPlan = stepContent.includes('финансовый') || stepContent.includes('бюджет') || stepContent.includes('расчет');
  const isMarketingPlan = stepContent.includes('маркетинг') || stepContent.includes('продвижение');
  const isOperationalPlan = stepContent.includes('операционный') || stepContent.includes('управление');
  const isRiskAnalysis = stepContent.includes('риск') || stepContent.includes('риски');

  let enhancedPrompt = stepMessage.content;

  // Добавляем специфические инструкции для бизнес-планирования
  if (isMarketAnalysis) {
    enhancedPrompt += `

Для анализа рынка кофейни:
- Изучите демографию района (возраст, доход, образование)
- Оцените конкурентов (количество, цены, качество, уникальные предложения)
- Проанализируйте тренды рынка кофе в вашем регионе
- Определите сезонные колебания спроса
- Оцените потенциальный объем рынка`;
  } else if (isFinancialPlan) {
    enhancedPrompt += `

Для финансового плана кофейни:
- Рассчитайте первоначальные инвестиции (аренда, оборудование, ремонт)
- Оцените ежемесячные операционные расходы
- Спрогнозируйте доходы на основе количества клиентов и среднего чека
- Рассчитайте точку безубыточности
- Подготовьте прогноз прибыли на 1-3 года`;
  } else if (isMarketingPlan) {
    enhancedPrompt += `

Для маркетингового плана кофейни:
- Определите уникальное торговое предложение (УТП)
- Разработайте стратегию ценообразования
- Планируйте каналы продвижения (соцсети, локальная реклама)
- Создайте план лояльности клиентов
- Разработайте стратегию привлечения первых клиентов`;
  } else if (isOperationalPlan) {
    enhancedPrompt += `

Для операционного плана кофейни:
- Определите график работы и режим персонала
- Разработайте меню и технологические процессы
- Планируйте закупки сырья и поставщиков
- Создайте стандарты обслуживания
- Разработайте систему контроля качества`;
  } else if (isRiskAnalysis) {
    enhancedPrompt += `

Для анализа рисков кофейни:
- Оцените рыночные риски (конкуренция, изменение вкусов)
- Финансовые риски (нехватка средств, колебания цен)
- Операционные риски (поставки, персонал, оборудование)
- Репутационные риски
- Разработайте меры по минимизации каждого риска`;
  }

  if (isVisualizationStep) {
    // Извлекаем результаты поиска из контекста сообщения
    let searchContext = '';
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.content && lastMessage.content.includes('Результаты поиска в интернете:')) {
      const searchMatch = lastMessage.content.match(/Результаты поиска в интернете:\s*\n(.*?)(\n\n|$)/s);
      if (searchMatch) {
        searchContext = searchMatch[1];
      }
    }

    // Генерируем конфигурацию визуализации с использованием реальных данных
    const visualizationPrompt = `${enhancedPrompt}

${searchContext ? `РЕАЛЬНЫЕ ДАННЫЕ ИЗ ПОИСКА:
${searchContext}

` : ''}Создай визуализацию данных в формате JSON на основе найденной информации. Используй реальные цифры из результатов поиска.

ИНСТРУКЦИИ:
1. Проанализируй результаты поиска и извлеки все числовые данные
2. Используй конкретные цифры, найденные в поиске (рублей, процентов, количества)
3. Если данных недостаточно, используй обоснованные оценки на основе найденных трендов
4. НЕ используй плейсхолдеры типа XXXX или синтетические данные
5. Создай логичную визуализацию, соответствующую запросу пользователя

Примеры форматов данных:
- Для временных рядов: [{"name": "Янв", "value": 4000}, {"name": "Фев", "value": 3000}, ...]
- Для категорий: [{"name": "Электроника", "value": 35}, {"name": "Одежда", "value": 25}, ...]
- Для финансовых показателей: [{"name": "Выручка", "value": 1500000}, {"name": "Прибыль", "value": 300000}, ...]

Верни только JSON конфигурацию визуализации:
{
  "type": "bar",
  "data": [{"name": "Пример", "value": 100}],
  "title": "Заголовок графика",
  "xAxisKey": "name",
  "yAxisKey": "value"
}`;

    const visualizationResponse = await openai.chat.completions.create({
      model: model === "pro" ? "gpt-4" : "gpt-3.5-turbo",
      messages: [
        ...messages.slice(0, -1),
        { role: 'user', content: visualizationPrompt }
      ],
      temperature: 0.3, // Снижаем temperature для более точных данных
    });

    let visualizationJson = visualizationResponse.choices[0]?.message?.content || '{}';

    // Очищаем JSON от лишних символов
    visualizationJson = visualizationJson.trim();
    if (visualizationJson.startsWith('```json')) {
      visualizationJson = visualizationJson.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (visualizationJson.startsWith('```')) {
      visualizationJson = visualizationJson.replace(/```\s*/, '').replace(/```\s*$/, '');
    }

    // Проверяем, что JSON валидный
    try {
      JSON.parse(visualizationJson);
    } catch (error) {
      console.error('Invalid visualization JSON:', visualizationJson);
      // Возвращаем дефолтный JSON если невалидный
      visualizationJson = '{"type": "bar", "data": [{"name": "Пример", "value": 100}], "title": "Визуализация данных"}';
    }

    // Возвращаем ответ с визуализацией
    const explanation = "Вот визуализация данных:\n\n```json\n" + visualizationJson + "\n```\n\n";

    // Отправляем объяснение по частям
    for (const char of explanation) {
      if (onChunk) {
        onChunk(char);
      }
      // Небольшая задержка для имитации потоковой передачи
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return explanation;
  } else {
    // Обычное выполнение этапа с улучшенными инструкциями
    const stepMessages = messages.map((msg, index) => {
      if (index === messages.length - 1) {
        // Заменяем контент последнего сообщения на enhancedPrompt
        return {
          role: msg.role,
          content: enhancedPrompt,
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });

    const response = await openai.chat.completions.create({
      model: model === "pro" ? "gpt-4" : "gpt-3.5-turbo",
      messages: stepMessages,
      stream: true,
    });

    let stepResponse = '';

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        stepResponse += content;
        if (onChunk) {
          onChunk(content);
        }
      }
    }

    return stepResponse;
  }
};
