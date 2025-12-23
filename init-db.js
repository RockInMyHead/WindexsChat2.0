import { DatabaseService } from './src/lib/database.js';

console.log('🗄️  Initializing database...');

// Создаем тестового пользователя
const testUserId = DatabaseService.createUser('Test User', 'test@example.com', 100.0);
console.log(`✅ Created test user with ID: ${testUserId}`);

// Создаем тестовую сессию для проверки
const sessionId = DatabaseService.createSession('Test Session', testUserId);
console.log(`✅ Created test session with ID: ${sessionId}`);

// Сохраняем тестовые сообщения
const msg1Id = DatabaseService.saveMessage(sessionId, testUserId, 'user', 'Hello, AI!');
const msg2Id = DatabaseService.saveMessage(sessionId, testUserId, 'assistant', 'Hello! How can I help you today?');

console.log(`✅ Saved test messages: ${msg1Id}, ${msg2Id}`);

// Загружаем сообщения
const messages = DatabaseService.loadMessages(sessionId);
console.log(`✅ Loaded ${messages.length} messages from session ${sessionId}`);

// Проверяем сессии пользователя
const sessions = DatabaseService.getAllSessions(testUserId);
console.log(`✅ Loaded ${sessions.length} sessions for user ${testUserId}`);

console.log('🎉 Database initialized successfully!');
DatabaseService.close();
