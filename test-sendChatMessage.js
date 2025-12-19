// Test sendChatMessage logic
const query = 'какой курс биткойна';
const lowerQuery = query.toLowerCase();

// Функция определения необходимости веб-поиска (расширенная логика)
const requiresWebSearch = (query) => {
  const lowerQuery = query.toLowerCase();
  console.log('🔍 requiresWebSearch called with query:', query, 'lowerQuery:', lowerQuery);

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
    console.log('🔍 Simple query detected, no search needed');
    return false;
  }

  // 2. ФИНАНСОВЫЕ ДАННЫЕ И ЦЕНЫ
  const financialMatch = /(курс|цена|стоимост|цены|выплат|кредит|ставка|процент|доход|налог|сбор|взнос)/i.test(lowerQuery);
  const cryptoMatch1 = /(биткоин|доллар|евро|рубль|криптовалют|крипто|ценная бумага|акция|облигация)/i.test(lowerQuery);
  const cryptoMatch2 = /(биткоин|биткойн)/i.test(lowerQuery);
  const tickerMatch = /\b(btc|eth|bnb|ada|sol|dot|avax|matic|link|uni|usdc|usdt)\b/i.test(lowerQuery);

  console.log('🔍 Financial checks:', { financialMatch, cryptoMatch1, cryptoMatch2, tickerMatch });

  if (financialMatch || cryptoMatch1 || cryptoMatch2 || tickerMatch) {
    console.log('🔍 requiresWebSearch: TRUE for financial/crypto query');
    return true;
  }

  console.log('🔍 requiresWebSearch result: false for query:', query);
  return false;
};

// Test the logic
console.log('Testing query:', query);
console.log('Should require search:', requiresWebSearch(query));

// Simulate sendChatMessage logic for simple query
const internetEnabled = true;
const userMessage = { role: 'user', content: query };

console.log('\n--- Simulating sendChatMessage logic ---');
console.log('internetEnabled:', internetEnabled);
console.log('userMessage.content:', userMessage.content);

if (internetEnabled !== false) {
  const needsWebSearch = requiresWebSearch(userMessage.content);
  console.log('needsWebSearch:', needsWebSearch);

  if (needsWebSearch) {
    console.log('✅ Would perform web search');
  } else {
    console.log('❌ Would NOT perform web search');
  }
} else {
  console.log('❌ Internet search disabled');
}
