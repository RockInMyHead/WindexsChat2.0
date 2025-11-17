import { API_BASE_URL } from './api';

// Функция для проверки доступности API
// При использовании серверного прокси всегда возвращаем true,
// поскольку сервер сам проверит наличие API ключа
const isApiAvailable = () => {
  return true;
};

// Функция для поиска в интернете через backend API (обход CORS)
const searchWeb = async (query: string): Promise<string> => {
  // Автоматически добавляем год к запросам, если это актуальные данные
  let enhancedQuery = query;
  const lowerQuery = query.toLowerCase();

  // Всегда добавляем 2025 год для актуальных данных, если год не указан
  const needsYear = lowerQuery.includes('рынок') || lowerQuery.includes('статистика') ||
                   lowerQuery.includes('тренд') || lowerQuery.includes('анализ') ||
                   lowerQuery.includes('данные') || lowerQuery.includes('отчет') ||
                   lowerQuery.includes('исследование') || lowerQuery.includes('прогноз') ||
                   lowerQuery.includes('бизнес') || lowerQuery.includes('финанс') ||
                   lowerQuery.includes('экономик') || lowerQuery.includes('рост') ||
                   lowerQuery.includes('развитие') || lowerQuery.includes('состояние');

  if (needsYear && !/\b(202\d|201\d|200\d)\b/.test(query)) {
    enhancedQuery = `${query} 2025 год`;
    console.log('Enhanced search query with 2025 year:', enhancedQuery);
  }

  try {
    // Используем backend endpoint для поиска, который обходит CORS ограничения
    const searchResponse = await fetch(`${API_BASE_URL}/web-search?q=${encodeURIComponent(enhancedQuery)}`, {
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

// Функция выполнения параллельного поиска по всем запросам из плана
const executeParallelSearches = async (
  plan: PlanStep[],
  onSearchProgress?: (queries: string[]) => void
): Promise<Map<string, string>> => {
  const searchResults = new Map<string, string>();
  const allQueries: Array<{ query: string; purpose: string }> = [];

  // Собираем все поисковые запросы из плана
  plan.forEach((step, stepIndex) => {
    if (step.searchQueries && step.searchQueries.length > 0) {
      // Сортируем по приоритету (high → medium → low)
      const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
      const sortedQueries = [...step.searchQueries].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );

      sortedQueries.forEach((sq) => {
        allQueries.push({
          query: sq.query,
          purpose: `[Шаг ${stepIndex + 1}: ${step.step}] ${sq.purpose}`
        });
      });

      // Обновляем прогресс - показываем текущие активные запросы
      if (onSearchProgress && allQueries.length > 0) {
        const activeQueries = allQueries.map(item => item.query);
        onSearchProgress(activeQueries);
      }
    }
  });

  // Выполняем поиски параллельно (но ограничиваем одновременные запросы)
  const maxConcurrent = 3;
  for (let i = 0; i < allQueries.length; i += maxConcurrent) {
    const batch = allQueries.slice(i, i + maxConcurrent);
    const promises = batch.map(async (item) => {
      try {
        const result = await searchWeb(item.query);
        searchResults.set(`${item.query}||${item.purpose}`, result);
        console.log(`✓ Поиск выполнен: ${item.query}`);
      } catch (error) {
        console.error(`✗ Ошибка поиска: ${item.query}`, error);
        searchResults.set(`${item.query}||${item.purpose}`, `[Ошибка поиска: ${error}]`);
      }
    });

    await Promise.all(promises);
  }

  return searchResults;
};

// Функция определения необходимости веб-поиска (расширенная логика)
const requiresWebSearch = (query: string): boolean => {
  const lowerQuery = query.toLowerCase();

  // Простые запросы никогда не требуют поиска
  const isVerySimpleQuery = ['привет', 'hi', 'hello', 'здравствуй', 'здравствуйте', 'спасибо', 'благодарю', 'пока', 'до свидания', 'прощай', 'да', 'нет', 'ага', 'угу', 'хорошо', 'плохо', 'нормально', 'ок', 'окей', 'ладно', 'понятно', 'ясно', 'понял', 'хорошо'].some(simple =>
    lowerQuery.trim() === simple ||
    lowerQuery.trim().startsWith(simple + ' ') ||
    lowerQuery.trim().endsWith(' ' + simple) ||
    lowerQuery.trim().includes(' ' + simple + ' ')
  );

  const isTooShort = lowerQuery.trim().length < 3;
  const isOnlyEmojis = /^[\p{Emoji}\s]+$/u.test(lowerQuery.trim());

  if (isVerySimpleQuery || isTooShort || isOnlyEmojis) {
    return false;
  }

  // ВИЗУАЛИЗАЦИИ: всегда требуют поиска актуальных данных
  if (lowerQuery.includes('визуализ') || lowerQuery.includes('покажи график') ||
      lowerQuery.includes('данные для график') || lowerQuery.includes('создать визуализацию')) {
    return true;
  }

  // =========== КЛЮЧЕВЫЕ СЛОВА, ТРЕБУЮЩИЕ ВЕСА ПОИСКА ===========
  
  // 1. АКТУАЛЬНОСТЬ И ВРЕМЯ (требуют свежей информации)
  if (/\b(сейчас|сегодня|вчера|завтра|текущ|последн|новый|современн|актуальн|свеж|недавн|сегодняшн|новост|событи|происшествие)\b/i.test(lowerQuery)) {
    return true;
  }

  // 2. ФИНАНСОВЫЕ ДАННЫЕ И ЦЕНЫ
  if (/\b(курс|цена|стоимост|цены|выплат|кредит|ставка|процент|доход|налог|сбор|взнос)\b/i.test(lowerQuery) ||
      /\b(биткоин|доллар|евро|рубль|криптовалют|крипто|ценная бумага|акция|облигация)\b/i.test(lowerQuery) ||
      /\b(btc|eth|bnb|ada|sol|dot|avax|matic|link|uni|usdc|usdt)\b/i.test(lowerQuery)) {
    return true;
  }

  // 3. СТАТИСТИКА, РЕЙТИНГИ, ТОП СПИСКИ
  if (/\b(рейтинг|топ|лучш|худш|статистик|данные|отчет|анализ|исследован|опрос|результат)\b/i.test(lowerQuery)) {
    return true;
  }

  // 4. НОВОСТИ, СОБЫТИЯ, ПРОИСШЕСТВИЯ
  if (/\b(новост|событи|происшестви|трагед|катастроф|аварий|авари|сообщ|объявлен|зарегистр)\b/i.test(lowerQuery)) {
    return true;
  }

  // 5. ГЕОГРАФИЧЕСКИЕ, ДЕМОГРАФИЧЕСКИЕ И СОЦИАЛЬНЫЕ ДАННЫЕ
  if (/\b(население|жител|город|страна|регион|область|район|адрес|место|географи|климат|погод|метеоролог|условия)\b/i.test(lowerQuery)) {
    return true;
  }

  // 6. БИЗНЕС, МАРКЕТИНГ, РЫНОК (требуют актуальных данных)
  if (/\b(бизнес|рынок|продаж|продажа|сбыт|конкурент|конкуренция|промышлен|индустри|секторе|компани|корпоратив)\b/i.test(lowerQuery)) {
    return true;
  }

  // 7. СПРОС, ПРЕДЛОЖЕНИЕ, ТРЕНДЫ
  if (/\b(спрос|предложени|тренд|мод|популярн|популярность|спрашиваемость|востребован)\b/i.test(lowerQuery)) {
    return true;
  }

  // 8. ТЕХНОЛОГИИ И ИННОВАЦИИ (часто требуют свежих данных)
  if (/\b(технолог|инновац|гаджет|приложени|платформ|сервис|облако|искусственн|машинн|программн|софт)\b/i.test(lowerQuery)) {
    return true;
  }

  // 9. ЗДОРОВЬЕ И МЕДИЦИНА (требуют актуальной информации)
  if (/\b(болезнь|лечени|препарат|лекарств|вирус|эпидеми|здоров|медицин|доктор|больниц|поликлиник)\b/i.test(lowerQuery)) {
    return true;
  }

  // 10. ОБРАЗОВАНИЕ И КАРЬЕРА (часто изменяется)
  if (/\b(университ|школ|вуз|программ|курс|специальност|карьер|професси|должност|зарплат|работ|вакансия)\b/i.test(lowerQuery)) {
    return true;
  }

  // 11. ТУРИЗМ И ПУТЕШЕСТВИЯ
  if (/\b(туризм|путеш|экскурс|гостинец|отель|пляж|достопримечательност|виза|паспорт|билет|авиалиния|маршрут)\b/i.test(lowerQuery)) {
    return true;
  }

  // 12. ЗАКОН И ПРАВО (часто меняется законодательство)
  if (/\b(закон|право|судь|адвокат|юрист|скоро|штраф|наказани|преступлени|суд|истец|ответчик)\b/i.test(lowerQuery)) {
    return true;
  }

  // 13. СПОРТ И РАЗВЛЕЧЕНИЯ (результаты, рейтинги, расписания)
  if (/\b(спорт|чемпионат|турнир|матч|игра|финал|команд|игрок|тренер|тренировк|результат|расписани)\b/i.test(lowerQuery)) {
    return true;
  }

  // 14. ИНФОРМАЦИОННЫЕ ЗАПРОСЫ (что, кто, где, когда, как)
  if (/^(что|кто|где|когда|как|почему|зачем)\b/i.test(lowerQuery.trim())) {
    return true;
  }

  // 15. ОПРЕДЕЛЕНИЯ И ИНФОРМАЦИЯ О СУЩНОСТЯХ
  if (/\b(определени|означает|есть|является|это|что это|кто это|информация|подробност|описани)\b/i.test(lowerQuery)) {
    return true;
  }

  // Если запрос требует плана (содержит слова "план", "анализ") и это первый запрос - нужен поиск
  if (/\b(план|анализ|исследован|изучи|выясни|узнай|подели информацию)\b/i.test(lowerQuery)) {
    return true;
  }

  // Стандартно включаем поиск для большинства запросов если это не явная творческая задача
  // Отключаем поиск только для явной творческой работы
  const isCreativeOnly = /^(напиши|создай|придумай|сочини|нарисуй|спроектируй|разработай дизайн|напиши историю|напиши код без|создай картинку)\b/i.test(lowerQuery.trim());
  
  if (!isCreativeOnly && lowerQuery.length > 5) {
    // Для большинства других запросов включаем поиск
    return true;
  }

  return false;
};

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface SearchQuery {
  query: string;
  priority: 'high' | 'medium' | 'low';
  purpose: string; // Для какого шага нужен поиск
}

export interface PlanStep {
  step: string;
  description: string;
  searchQueries?: SearchQuery[]; // Что нужно найти для этого шага
  completed: boolean;
}

// Функция для обработки простых запросов без поиска
const getSimpleResponse = async (query: string): Promise<string> => {
  const lowerQuery = query.toLowerCase().trim();

  // Простые приветствия
  if (lowerQuery === 'привет' || lowerQuery === 'hi' || lowerQuery === 'hello') {
    return 'Привет! 👋 Я WindexsAI - ваш помощник в решении различных задач. Чем могу помочь сегодня?';
  }

  if (lowerQuery === 'здравствуй' || lowerQuery === 'здравствуйте') {
    return 'Здравствуйте! 👋 Я WindexsAI, готов помочь вам с любыми вопросами и задачами.';
  }

  // Простые ответы
  if (['спасибо', 'благодарю'].includes(lowerQuery)) {
    return 'Пожалуйста! 😊 Если вам понадобится помощь, я всегда здесь.';
  }

  if (['пока', 'до свидания', 'прощай'].includes(lowerQuery)) {
    return 'До свидания! 👋 Возвращайтесь, когда понадобится помощь.';
  }

  if (['да', 'нет', 'ага', 'угу'].includes(lowerQuery)) {
    return 'Понятно! Если у вас есть другие вопросы или задачи, я готов помочь.';
  }

  if (['хорошо', 'плохо', 'нормально', 'ок', 'окей', 'ладно'].includes(lowerQuery)) {
    return 'Отлично! Если вам нужна помощь с чем-то конкретным, просто спросите.';
  }

  if (['понятно', 'ясно', 'понял'].includes(lowerQuery)) {
    return 'Рад, что все понятно! Если возникнут вопросы, обращайтесь. 😉';
  }

  // Для очень коротких сообщений
  if (lowerQuery.length < 3) {
    return 'Привет! 👋 Я WindexsAI. Чем могу вам помочь?';
  }

  // Для эмодзи
  if (/^[\p{Emoji}\s]+$/u.test(lowerQuery)) {
    return '😊 Привет! Я WindexsAI, готов помочь вам с любыми задачами.';
  }

  // Для всех остальных простых запросов
  return 'Привет! 👋 Я WindexsAI - ИИ-помощник для решения различных задач. Что именно вас интересует?';
};

// Функция для определения реальной модели OpenAI на основе выбранного режима
const getActualModel = (selectedModel: string): string => {
  switch (selectedModel) {
    case 'pro':
      return 'gpt-4o'; // Оптимизированная модель GPT-4o для Pro режима
    case 'lite':
    default:
      return 'gpt-4o-mini'; // Быстрая и экономичная модель для Lite режима
  }
};

// Получить параметры для модели
const getModelParams = (selectedModel: string) => {
  if (selectedModel === 'pro') {
    return {
      max_tokens: 1024, // оптимизированное ограничение для скорости в Pro режиме
      temperature: 0.7  // стандартная креативность
    };
  }
  return {
    max_tokens: 4096, // полное ограничение для lite режима
    temperature: 0.7  // стандартная креативность
  };
};

export const sendChatMessage = async (
  messages: Message[],
  selectedModel: string = "lite",
  onChunk?: (chunk: string) => void,
  onPlanGenerated?: (plan: PlanStep[]) => void,
  onStepStart?: (stepIndex: number, step: PlanStep) => void,
  onSearchProgress?: (queries: string[]) => void,
  internetEnabled?: boolean,
  abortSignal?: AbortSignal
): Promise<string> => {
  // Конвертируем выбранную модель в реальную модель OpenAI
  const actualModel = getActualModel(selectedModel);
  const modelParams = getModelParams(selectedModel);
  console.log('sendChatMessage called with:', { messagesCount: messages.length, selectedModel, actualModel, modelParams, hasOnChunk: !!onChunk });

  // Проверяем, является ли запрос очень простым
  const userMessage = messages[messages.length - 1];
  if (userMessage && userMessage.role === 'user') {
    const lowerQuery = userMessage.content.toLowerCase().trim();

    const isVerySimpleQuery = ['привет', 'hi', 'hello', 'здравствуй', 'здравствуйте', 'спасибо', 'благодарю', 'пока', 'до свидания', 'прощай', 'да', 'нет', 'ага', 'угу', 'хорошо', 'плохо', 'нормально', 'ок', 'окей', 'ладно', 'понятно', 'ясно', 'понял', 'хорошо'].some(simple =>
      lowerQuery === simple ||
      lowerQuery.startsWith(simple + ' ') ||
      lowerQuery.endsWith(' ' + simple) ||
      lowerQuery.includes(' ' + simple + ' ')
    );

    const isTooShort = lowerQuery.length < 3;
    const isOnlyEmojis = /^[\p{Emoji}\s]+$/u.test(lowerQuery);

    if (isVerySimpleQuery || isTooShort || isOnlyEmojis) {
      console.log('Simple query detected, returning direct response without search or planning');
      // Возвращаем простой ответ без поиска и планирования
      const simpleResponse = await getSimpleResponse(userMessage.content);
      return simpleResponse;
    }
  }

  try {
    // Проверяем доступность API
    console.log('Checking API availability...');
    if (!isApiAvailable()) {
      console.log('API not available');
      return "Извините, сервис AI временно недоступен. Пожалуйста, проверьте настройки API ключа.";
    }
    console.log('API is available');
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

      // Проверяем тип запроса для генерации плана
      const isVerySimpleQuery = ['привет', 'hi', 'hello', 'здравствуй', 'здравствуйте', 'спасибо', 'благодарю', 'пока', 'до свидания', 'прощай', 'да', 'нет', 'ага', 'угу', 'хорошо', 'плохо', 'нормально', 'ок', 'окей', 'ладно', 'понятно', 'ясно', 'понял', 'хорошо'].some(simple =>
        lowerQuery.trim() === simple ||
        lowerQuery.trim().startsWith(simple + ' ') ||
        lowerQuery.trim().endsWith(' ' + simple) ||
        lowerQuery.trim().includes(' ' + simple + ' ')
      );

      // Очень короткие запросы никогда не требуют поиска или планирования
      const isTooShort = lowerQuery.trim().length < 3;
      const isOnlyEmojis = /^[\p{Emoji}\s]+$/u.test(lowerQuery.trim());

      const isSimpleQuery = isVerySimpleQuery || isTooShort || isOnlyEmojis;

      // Генерируем план для комплексных задач и запросов
      const shouldGeneratePlan = !isSimpleQuery && (
        // Явные запросы на планирование
        lowerQuery.includes('план') ||
        lowerQuery.includes('разработ') ||
        lowerQuery.includes('созда') ||
        lowerQuery.includes('проект') ||
        lowerQuery.includes('задач') ||
        lowerQuery.includes('шаг') ||
        lowerQuery.includes('анализ') ||
        lowerQuery.includes('исследов') ||
        lowerQuery.includes('подготов') ||
        lowerQuery.includes('организ') ||
        // Многоэтапные инструкции
        (lowerQuery.split(/[.!?]/).length > 1) ||
        // Длинные запросы с множественными действиями
        (lowerQuery.length > 100 && lowerQuery.split(' ').length > 15) ||
        // Запросы с числами и списками
        /\d+\./.test(lowerQuery) || // содержит нумерованные списки
        lowerQuery.includes('во-первых') ||
        lowerQuery.includes('во-вторых') ||
        lowerQuery.includes('затем') ||
        lowerQuery.includes('далее') ||
        lowerQuery.includes('наконец') ||
        // Бизнес и технические запросы
        lowerQuery.includes('бизнес') ||
        lowerQuery.includes('маркетинг') ||
        lowerQuery.includes('финанс') ||
        lowerQuery.includes('программирован') ||
        lowerQuery.includes('дизайн') ||
        lowerQuery.includes('управлен') ||
        // Образовательные запросы
        lowerQuery.includes('объясн') ||
        lowerQuery.includes('научи') ||
        lowerQuery.includes('покажи как')
      );

      if (shouldGeneratePlan) {
        plan = await generateResponsePlan(userMessage.content, selectedModel);
      }

      // Проверяем, требуется ли поиск в интернете
      // Для запросов на визуализацию поиск ВСЕГДА нужен (даже если это content creation)
      const isVisualizationRequest = (
        // Явные запросы на визуализацию
        lowerQuery.includes('визуализ') ||
        lowerQuery.includes('покажи график') ||
        lowerQuery.includes('создай график') ||
        lowerQuery.includes('нарисуй график') ||
        lowerQuery.includes('построй график') ||
        lowerQuery.includes('сделай диаграмм') ||
        // Специфические запросы с данными И графикой
        (lowerQuery.includes('данные') && lowerQuery.includes('график')) ||
        (lowerQuery.includes('статистик') && lowerQuery.includes('график')) ||
        (lowerQuery.includes('числа') && lowerQuery.includes('диаграмм'))
      );

      // Для запросов с планом ВСЕГДА нужен веб-поиск для получения актуальных данных
      const shouldSearchForPlan = shouldGeneratePlan && plan.length > 0;

      if ((!isContentCreation || isVisualizationRequest || shouldSearchForPlan) && internetEnabled !== false) {
        const needsWebSearch = requiresWebSearch(userMessage.content) || shouldSearchForPlan;

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

      // Генерируем один структурированный ответ со всеми шагами
      if (plan.length > 0) {
        // НОВОЕ: Выполняем ПАРАЛЛЕЛЬНЫЙ поиск по всем запросам из плана
        let allSearchResults: Map<string, string> = new Map();

        if (plan.some(step => step.searchQueries && step.searchQueries.length > 0) && internetEnabled !== false) {
          console.log('🔍 Начинаем параллельный поиск в интернете...');
          // Собираем все запросы для отображения прогресса
          const allSearchQueries = plan.flatMap(step =>
            step.searchQueries ? step.searchQueries.map(sq => sq.query) : []
          );
          if (onSearchProgress) {
            onSearchProgress(allSearchQueries);
          }
          allSearchResults = await executeParallelSearches(plan, onSearchProgress);
          console.log(`✅ Параллельный поиск завершен: ${allSearchResults.size} результатов`);
          // Очищаем прогресс после завершения
          if (onSearchProgress) {
            onSearchProgress([]);
          }
        }

        // Форматируем результаты поиска по шагам
        let formattedSearchContext = '';
        if (allSearchResults.size > 0) {
          formattedSearchContext = 'ДАННЫЕ ИЗ ИНТЕРНЕТА:\n\n';
          
          plan.forEach((step, stepIndex) => {
            if (step.searchQueries && step.searchQueries.length > 0) {
              formattedSearchContext += `📌 Шаг ${stepIndex + 1}: ${step.step}\n`;
              
              step.searchQueries.forEach((sq) => {
                const key = `${sq.query}||[Шаг ${stepIndex + 1}: ${step.step}] ${sq.purpose}`;
                const result = allSearchResults.get(key);
                
                if (result && result !== '[NO_RESULTS_FOUND]') {
                  formattedSearchContext += `\n🔹 ${sq.purpose} (${sq.query}):\n${result}\n`;
                }
              });
              
              formattedSearchContext += '\n';
            }
          });
        }

          const systemMessage = messages.find(msg => msg.role === 'system') || {
            role: 'system' as const,
            content: 'Ты полезный AI-ассистент. Каждый чат является полностью независимым и изолированным. Не используй информацию или контекст из других разговоров. Отвечай только на основе предоставленных сообщений в текущем чате.'
          };

        // Форматируем план для промпта
        const planDescription = plan.map((step, idx) => 
          `${idx + 1}. **${step.step}**: ${step.description}`
        ).join('\n\n');

        const planPrompt = [
            systemMessage,
            {
              role: 'user' as const,
            content: `${formattedSearchContext}
ПЛАН РЕШЕНИЯ:

${planDescription}

ИНСТРУКЦИИ:
- КРИТИЧНО: ИСПОЛЬЗУЙ ТОЛЬКО ДАННЫЕ ЗА 2024-2025 ГОДЫ! ЗАПРЕЩЕНО УПОМИНАТЬ 2023 ГОД И РАНЬШЕ!
- ИСПОЛЬЗУЙ ДАННЫЕ ИЗ ИНТЕРНЕТА для каждого пункта плана
- ВЫПОЛНИ ВСЮ РАБОТУ САМ - создай один структурированный профессиональный ответ
- Раздели ответ по пунктам плана (используй форматирование Markdown)
- Для каждого пункта:
  * Используй РЕАЛЬНЫЕ ДАННЫЕ из поиска 2024-2025 годов
  * Приводи конкретные цифры, статистику, факты за 2024-2025
  * Делай обоснованные выводы на основе свежих данных
  * Связывай информацию между пунктами
- Стиль: пиши как профессиональный эксперт/консультант
- РЕЗУЛЬТАТ должен быть готов к использованию - не давай советы, приводи выводы
- Структурируй текст списками, подзаголовками, форматированием
- Каждый пункт должен быть ДЕТАЛЬНЫМ и КОНКРЕТНЫМ

Исходный запрос: "${userMessage.content}"

СОЗДАЙ ПРОФЕССИОНАЛЬНЫЙ СТРУКТУРИРОВАННЫЙ ОТВЕТ НА ОСНОВЕ СОБРАННЫХ ДАННЫХ:`
          }
        ];

        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: planPrompt.map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
            model: actualModel,
            stream: true,
            ...modelParams,
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    if (onChunk) {
                      onChunk(content);
                    }
                  }
                } catch (e) {
                  // Игнорируем невалидный JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Отмечаем все шаги как завершенные (они уже обработаны в одном ответе)
        plan.forEach((step) => {
          step.completed = true;
        });
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

        console.log('Making fetch request to:', `${API_BASE_URL}/chat`);
        console.log('Request payload:', {
          messagesCount: enhancedMessages.length,
          model: actualModel,
          stream: true
        });

        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: enhancedMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
            model: actualModel,
            stream: true,
            ...modelParams,
          }),
          signal: abortSignal,
        });

        console.log('Fetch response status:', response.status, response.statusText);

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    if (onChunk) {
                      onChunk(content);
                    }
                  }
                } catch (e) {
                  // Игнорируем невалидный JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

      }
    } else {
      // Обычный ответ без плана (для последующих сообщений)
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          model: actualModel,
          stream: true,
          ...modelParams,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  if (onChunk) {
                    onChunk(content);
                  }
                }
              } catch (e) {
                // Игнорируем невалидный JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
};

// Генерация плана ответа
const generateResponsePlan = async (userQuestion: string, selectedModel: string): Promise<PlanStep[]> => {
  // Проверяем доступность API
  if (!isApiAvailable()) {
    return []; // Возвращаем пустой план при недоступности API
  }

  const actualModel = getActualModel(selectedModel);
  const modelParams = getModelParams(selectedModel);

  const planPrompt = `
СОЗДАЙ ПЛАН С УКАЗАНИЕМ ПОИСКОВЫХ ЗАПРОСОВ ДЛЯ ИНТЕРНЕТА

КРИТИЧНО ВАЖНО: СЕЙЧАС 2025 ГОД! ТЕКУЩИЙ ГОД - 2025!
ОБЯЗАТЕЛЬНО ИСПОЛЬЗУЙ ТОЛЬКО ДАННЫЕ ЗА 2024-2025 ГОДЫ!
ЗАПРЕЩЕНО ИСПОЛЬЗОВАТЬ ДАННЫЕ ИЗ 2023 ГОДА И РАНЬШЕ!
ВСЕ ПОИСКОВЫЕ ЗАПРОСЫ ДОЛЖНЫ СОДЕРЖАТЬ "2025" ИЛИ "2024"!

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${userQuestion}"

ИНСТРУКЦИИ:
1. РАЗБЕРИСЬ в задаче - что нужно СОЗДАТЬ/ВЫПОЛНИТЬ
2. РАЗДЕЛИ на 3-7 шагов, каждый с РЕЗУЛЬТАТОМ
3. ДЛЯ КАЖДОГО ШАГА укажи ЧТО НУЖНО НАЙТИ В ИНТЕРНЕТЕ:
   - searchQueries: массив поисковых запросов
   - Для высокого приоритета (high) - критичные данные для этого шага
   - Для среднего (medium) - дополнительные данные
   - Для низкого (low) - опциональные данные

ТИПЫ ПОИСКОВ ПО ШАГАМ:
• Для бизнес-плана: статистика рынка, конкуренты, цены, тренды, спрос
• Для анализа: свежие данные, статистика, отчёты, тренды
• Для технологий: новые решения, технологии, бенчмарки, рекомендации
• Для финансов: курсы, процентные ставки, цены, анализ

ПРАВИЛА:
- Шаги идут в логической последовательности
- КАЖДЫЙ ШАГ производит результат
- Поиск помогает получить АКТУАЛЬНЫЕ ДАННЫЕ для каждого шага
- searchQueries содержит конкретные поисковые фразы
- ОБЯЗАТЕЛЬНО: ВСЕ ПОИСКОВЫЕ ЗАПРОСЫ ДОЛЖНЫ ЗАКАНЧИВАТЬСЯ НА "2025 ГОД" ИЛИ "2025"
- СТРОГО ЗАПРЕЩЕНО: НЕ ДОБАВЛЯТЬ ГОД 2023 ИЛИ РАНЬШЕ!
- ТОЛЬКО 2024-2025 ГОДЫ В ВСЕХ ЗАПРОСАХ!

ФОРМАТ ОТВЕТА - ТОЛЬКО JSON:
[
  {
    "step": "Анализ рынка",
    "description": "Исследовать текущее состояние рынка с актуальными данными",
    "searchQueries": [
      {
        "query": "рынок кофеен в России 2025 год статистика",
        "priority": "high",
        "purpose": "Размер и динамика рынка 2025"
      },
      {
        "query": "конкуренты кофеен Москва 2025 анализ",
        "priority": "high",
        "purpose": "Анализ конкурентов 2025"
      },
      {
        "query": "тренды кофейного рынка 2025 год",
        "priority": "medium",
        "purpose": "Текущие тренды 2025"
      }
    ],
    "completed": false
  },
  {
    "step": "Финансовое планирование",
    "description": "Составить финансовый прогноз на основе актуальных данных",
    "searchQueries": [
      {
        "query": "средняя прибыль кофейни 2025 год",
        "priority": "high",
        "purpose": "Финансовые показатели"
      }
    ],
    "completed": false
  }
]
`;

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'Ты - помощник, который создает планы ответов. Всегда отвечай только в формате JSON.' },
        { role: 'user', content: planPrompt }
      ],
      model: actualModel,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Plan generation API error: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();

  const planText = responseData.choices[0]?.message?.content || '[]';

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
  selectedModel: string,
  onChunk?: (chunk: string) => void
): Promise<string> => {
  // Конвертируем выбранную модель в реальную модель OpenAI
  const actualModel = getActualModel(selectedModel);
  const modelParams = getModelParams(selectedModel);

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

    const visualizationResponse = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          ...messages.slice(0, -1),
          { role: 'user', content: visualizationPrompt }
        ],
          model: actualModel,
        stream: false,
          ...modelParams,
      }),
    });

    if (!visualizationResponse.ok) {
      throw new Error(`Visualization API error: ${visualizationResponse.status} ${visualizationResponse.statusText}`);
    }

    const visualizationData = await visualizationResponse.json();
    let visualizationJson = visualizationData.choices[0]?.message?.content || '{}';

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

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: stepMessages,
        model: actualModel,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Step execution API error: ${response.status} ${response.statusText}`);
    }

    let stepResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                stepResponse += content;
                if (onChunk) {
                  onChunk(content);
                }
              }
            } catch (e) {
              // Игнорируем невалидный JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return stepResponse;
  }
};
