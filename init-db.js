import { DatabaseService } from './src/lib/database.js';

console.log('🗄️  Initializing database...');

// Создаем тестовую сессию для проверки
const sessionId = DatabaseService.createSession('Test Session');
console.log(`✅ Created test session with ID: ${sessionId}`);

// Сохраняем тестовые сообщения
const msg1Id = DatabaseService.saveMessage(sessionId, 'user', 'Hello, AI!');
const msg2Id = DatabaseService.saveMessage(sessionId, 'assistant', 'Hello! How can I help you today?');

console.log(`✅ Saved test messages: ${msg1Id}, ${msg2Id}`);

// Загружаем сообщения
const messages = DatabaseService.loadMessages(sessionId);
console.log(`✅ Loaded ${messages.length} messages from session ${sessionId}`);

console.log('🎉 Database initialized successfully!');
DatabaseService.close();
