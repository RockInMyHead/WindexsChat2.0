import Database from 'better-sqlite3';
import path from 'path';

// Определяем интерфейсы для TypeScript
export const Message = {
  // Just for reference, actual validation happens in code
};

export const ChatSession = {
  // Just for reference, actual validation happens in code
};

// Путь к файлу базы данных
const DB_PATH = path.join(process.cwd(), 'windexs_chat.db');

// Инициализация базы данных
const db = new Database(DB_PATH);

// Включаем foreign keys
db.pragma('foreign_keys = ON');

// Создание таблиц
const createTables = () => {
  // Таблица чатов/сессий
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Таблица сообщений (без artifact_id сначала)
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
    )
  `);

  // Таблица артефактов
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('website')),
      title TEXT NOT NULL,
      files_json TEXT NOT NULL,
      deps_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
    )
  `);

  // Миграция: Добавляем колонку artifact_id в messages, если её нет
  const columns = db.prepare("PRAGMA table_info(messages)").all();
  const hasArtifactId = columns.some(col => col.name === 'artifact_id');
  
  if (!hasArtifactId) {
    console.log('Migrating database: adding artifact_id column to messages table');
    db.exec(`ALTER TABLE messages ADD COLUMN artifact_id INTEGER`);
  }

  // Индексы для производительности
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages (session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_artifact_id ON messages (artifact_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_session_id ON artifacts (session_id);
  `);
};

// Инициализация таблиц при первом запуске
createTables();

// Подготовка запросов
const insertMessageStmt = db.prepare(`
  INSERT INTO messages (session_id, role, content, timestamp, artifact_id)
  VALUES (?, ?, ?, ?, ?)
`);

const getMessagesBySessionStmt = db.prepare(`
  SELECT id, role, content, timestamp, artifact_id
  FROM messages
  WHERE session_id = ?
  ORDER BY timestamp ASC
`);

const getAllSessionsStmt = db.prepare(`
  SELECT id, title, created_at, updated_at
  FROM chat_sessions
  ORDER BY updated_at DESC
`);

const insertSessionStmt = db.prepare(`
  INSERT INTO chat_sessions (title, created_at, updated_at)
  VALUES (?, ?, ?)
`);

const updateSessionTimestampStmt = db.prepare(`
  UPDATE chat_sessions
  SET updated_at = ?
  WHERE id = ?
`);

const updateSessionTitleStmt = db.prepare(`
  UPDATE chat_sessions
  SET title = ?
  WHERE id = ?
`);

const deleteSessionStmt = db.prepare(`
  DELETE FROM chat_sessions WHERE id = ?
`);

// Артефакты
const insertArtifactStmt = db.prepare(`
  INSERT INTO artifacts (session_id, type, title, files_json, deps_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const getArtifactByIdStmt = db.prepare(`
  SELECT id, session_id, type, title, files_json, deps_json, created_at, updated_at
  FROM artifacts
  WHERE id = ?
`);

const updateArtifactStmt = db.prepare(`
  UPDATE artifacts
  SET title = ?, files_json = ?, deps_json = ?, updated_at = ?
  WHERE id = ?
`);

const getArtifactsBySessionStmt = db.prepare(`
  SELECT id, session_id, type, title, files_json, deps_json, created_at, updated_at
  FROM artifacts
  WHERE session_id = ?
  ORDER BY created_at DESC
`);

// Сервис для работы с базой данных
export class DatabaseService {
  // Создание новой сессии чата
  static createSession(title) {
    const now = Date.now();
    const result = insertSessionStmt.run(title, now, now);
    return result.lastInsertRowid;
  }

  // Сохранение сообщения
  static saveMessage(sessionId, role, content, artifactId = null) {
    const timestamp = Date.now();
    const result = insertMessageStmt.run(sessionId, role, content, timestamp, artifactId);

    // Обновляем timestamp сессии
    updateSessionTimestampStmt.run(timestamp, sessionId);

    return result.lastInsertRowid;
  }

  // Загрузка сообщений сессии
  static loadMessages(sessionId) {
    const rows = getMessagesBySessionStmt.all(sessionId);
    return rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      artifactId: row.artifact_id
    }));
  }

  // Получение всех сессий
  static getAllSessions() {
    const rows = getAllSessionsStmt.all();
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  // Обновление заголовка сессии
  static updateSessionTitle(sessionId, title) {
    updateSessionTitleStmt.run(title, sessionId);
  }

  // Удаление сессии
  static deleteSession(sessionId) {
    deleteSessionStmt.run(sessionId);
  }

  // Создание артефакта
  static createArtifact(sessionId, type, title, files, deps = null) {
    const now = Date.now();
    const filesJson = JSON.stringify(files);
    const depsJson = deps ? JSON.stringify(deps) : null;
    const result = insertArtifactStmt.run(sessionId, type, title, filesJson, depsJson, now, now);
    return result.lastInsertRowid;
  }

  // Получение артефакта по ID
  static getArtifact(artifactId) {
    const row = getArtifactByIdStmt.get(artifactId);
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      title: row.title,
      files: JSON.parse(row.files_json),
      deps: row.deps_json ? JSON.parse(row.deps_json) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Обновление артефакта
  static updateArtifact(artifactId, title, files, deps = null) {
    const now = Date.now();
    const filesJson = JSON.stringify(files);
    const depsJson = deps ? JSON.stringify(deps) : null;
    updateArtifactStmt.run(title, filesJson, depsJson, now, artifactId);
  }

  // Получение всех артефактов сессии
  static getArtifactsBySession(sessionId) {
    const rows = getArtifactsBySessionStmt.all(sessionId);
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      title: row.title,
      files: JSON.parse(row.files_json),
      deps: row.deps_json ? JSON.parse(row.deps_json) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  // Закрытие соединения с БД (для cleanup)
  static close() {
    db.close();
  }
}

// Экспортируем экземпляр базы данных для прямого доступа при необходимости
export { db };
