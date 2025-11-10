# 🚀 WindexsChat 2.0 - AI-ассистент с расширенными возможностями

**WindexsChat 2.0** - это полнофункциональный AI-ассистент с поддержкой чатов, обработки файлов, визуализации данных и многого другого.

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/RockInMyHead/WindexsChat2.0)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 🚀 Быстрый старт

### Установка и запуск

**Требования:**
- Node.js 18+ и npm
- Git

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/RockInMyHead/WindexsChat2.0.git
cd WindexsChat2.0

# 2. Установите зависимости
npm install

# 3. Инициализируйте базу данных
npm run init-db

# 4. Запустите приложение
npm run dev:full
```

Приложение будет доступно по адресу:
- **Frontend:** http://localhost:8081
- **API сервер:** http://localhost:3003

### Настройка OpenAI API

1. Получите API ключ от [OpenAI](https://platform.openai.com/api-keys)
2. Создайте файл `.env` в корне проекта:
```bash
VITE_OPENAI_API_KEY=your_api_key_here
```

### Доступные скрипты

```bash
npm run dev          # Запуск frontend (Vite)
npm run server       # Запуск API сервера (Express)
npm run dev:full     # Запуск всего приложения
npm run init-db      # Инициализация базы данных
npm run build        # Сборка для production
npm run preview      # Просмотр сборки
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- SQLite (better-sqlite3)
- OpenAI API
- Express.js (API server)

## Database Features

The application includes a local SQLite database that stores:

- Chat sessions with titles and timestamps
- All messages (user and AI responses)
- Automatic session management

## File Processing Features

The application can process various types of documents and images:

### Supported File Types
- **PDF documents** - text extraction from PDF files
- **DOCX documents** - text extraction from Word documents
- **TXT files** - plain text files
- **Images** - OCR (Optical Character Recognition) for:
  - PNG, JPG, JPEG images
  - BMP, TIFF, WebP formats
  - Support for Russian and English text

### How File Processing Works
1. Click the 📎 button in the chat input
2. Select a supported file (max 10MB)
3. The file is processed locally in your browser
4. Extracted text is automatically sent to AI for analysis
5. AI provides a summary and analysis of the document content

### Privacy & Security
- All file processing happens locally in your browser
- Files are not uploaded to external servers
- OCR processing uses Tesseract.js for offline text recognition
- Your documents remain private and secure

## AI Response Planning Features

The application includes an advanced intelligent response planning system that creates structured, multi-step responses for complex queries:

### Dynamic Plan Generation
- **Adaptive complexity** - Plans adjust based on query type:
  - Simple questions (greetings, facts): 1-2 steps
  - Creative tasks (writing, design): 3-6 steps
  - Analytical tasks: 4-8 steps
  - Business planning: 5-10 detailed steps
- **Context-aware planning** - Specialized strategies for different task types
- **Smart categorization** - Automatic detection of business, creative, analytical, and simple queries

### Business Planning Intelligence
The system includes specialized templates for comprehensive business planning:

#### **Market Analysis**
- Competitor research and positioning
- Demographic studies and target audience analysis
- Market trends and seasonal demand patterns
- Potential market size estimation

#### **Financial Planning**
- Initial investment calculations (rent, equipment, renovation)
- Monthly operational cost projections
- Revenue forecasting based on customer volume and average check
- Break-even point analysis and profitability projections

#### **Marketing Strategy**
- Unique value proposition (UVP) development
- Pricing strategy formulation
- Multi-channel promotion planning
- Customer loyalty program design

#### **Operational Planning**
- Staff scheduling and management
- Menu development and process optimization
- Supplier selection and procurement planning
- Quality control standards and service protocols

#### **Risk Assessment**
- Market risks (competition, changing preferences)
- Financial risks (funding gaps, price fluctuations)
- Operational risks (supplies, staff, equipment)
- Reputational risk management

### Real-time Progress Tracking
- **Visual step indicators** - Progress bars with completion status
- **Detailed descriptions** - Each step includes specific actions and expected outcomes
- **Streaming responses** - Real-time content generation for each planning phase
- **Context preservation** - Previous steps inform subsequent responses

### How It Works
1. User submits a complex query (e.g., "business plan for a coffee shop")
2. AI analyzes the query and determines appropriate complexity level
3. System generates a structured plan with 5-10 specific steps
4. Each step is executed sequentially with detailed instructions
5. User sees real-time progress and can track completion
6. Final comprehensive response covers all aspects of the query

## Data Visualization Features

The application can create interactive charts and graphs in the chat interface:

### Supported Chart Types
- **Line Charts** 📈 - for trends and time series data
- **Bar Charts** 📊 - for comparisons and categories
- **Pie Charts** 🥧 - for proportions and percentages
- **Area Charts** 📉 - for cumulative data visualization

### How Data Visualization Works
1. Ask AI about data analysis or visualization
2. AI creates a structured plan including visualization step
3. AI generates chart configuration in JSON format
4. Chart is automatically rendered in the chat message
5. Interactive tooltips and responsive design

### Chart Configuration Format
```json
{
  "type": "bar",
  "data": [
    {"name": "Category A", "value": 100},
    {"name": "Category B", "value": 200}
  ],
  "title": "Chart Title",
  "xAxisKey": "name",
  "yAxisKey": "value"
}
```

### Examples of Chart Requests
- "Покажи график продаж по месяцам"
- "Создай круговую диаграмму распределения бюджета"
- "Визуализируй данные о росте компании"
- "Нарисуй линейный график трендов"

### Technical Details
- Built with **Recharts** library for React
- **Responsive design** - adapts to screen size
- **Interactive elements** - hover effects and tooltips
- **Customizable colors** and styling
- **JSON-based configuration** for easy AI generation

### Chat Management Features

The application provides comprehensive chat management:

#### **Chat History**
- **Persistent storage** - All chats are saved to SQLite database
- **Automatic titles** - Chat titles are generated from first user message
- **Date grouping** - Chats are organized by date (Today, Yesterday, X days ago)
- **Real-time updates** - Chat list updates immediately after changes

#### **Chat Deletion**
- **Hover to delete** - Delete button appears on chat hover (desktop)
- **Right-click menu** - Context menu with delete option
- **Safety checks** - Cannot delete active chat or last remaining chat
- **Instant deletion** - Chats are deleted immediately without confirmation

#### **Safety Features**
- **Active chat protection** - Cannot delete currently open chat
- **Last chat protection** - At least one chat must remain
- **Error handling** - Proper error messages for failed operations
- **Immediate updates** - UI updates instantly after deletion

### Running with Database

```sh
# Initialize database (one-time setup)
npm run init-db

# Start both API server and frontend
npm run dev:full

# Or run them separately:
npm run server    # API server on port 3001
npm run dev       # Frontend on port 8083
```

The database file (`windexs_chat.db`) is created automatically and stores all your chat history locally.

## ✨ Ключевые возможности

### 🤖 AI интеграция
- Поддержка GPT-4 и GPT-3.5-turbo
- Интеллектуальное планирование ответов
- Потоковая генерация текста
- Анализ и обработка документов

### 📊 Визуализация данных
- Интерактивные графики (линейные, столбчатые, круговые)
- Реальные данные из интернета
- Автоматическая генерация JSON конфигураций
- Адаптивный дизайн

### 📁 Обработка файлов
- **PDF документы** - извлечение текста
- **Word документы** (DOCX) - обработка контента
- **Текстовые файлы** - прямое чтение
- **Изображения** - OCR на русском и английском
- **Безопасность** - локальная обработка, без загрузки на сервер

### 💬 Управление чатами
- Сохранение истории разговоров
- Автоматическая генерация заголовков
- Группировка по датам
- Удаление чатов с защитой

### 🎨 Современный интерфейс
- Темная тема с аккуратными стилями
- Адаптивный дизайн для всех устройств
- Красивые блоки кода с подсветкой
- Плавные анимации и переходы

## 🚀 Последние обновления (v2.0)

- ✅ **Исправлена ошибка 404** для PDF worker
- ✅ **Добавлены блоки кода** в Telegram-стиле
- ✅ **Реальные данные** для визуализаций (не синтетика)
- ✅ **Улучшенная система поиска** в интернете
- ✅ **Оптимизированные скрипты сборки**
- ✅ **Автоматизация** копирования зависимостей

## 🛠 Технологии

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Node.js + Express.js
- **База данных:** SQLite + better-sqlite3
- **UI:** Tailwind CSS + Shadcn/ui + Radix UI
- **AI:** OpenAI API (GPT-4, GPT-3.5-turbo)
- **Обработка файлов:** PDF.js, Tesseract.js, Mammoth.js
- **Визуализация:** Recharts

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. Подробности в файле [LICENSE](LICENSE).

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для вашей фичи (`git checkout -b feature/AmazingFeature`)
3. Зафиксируйте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Запушьте в ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📞 Поддержка

Если у вас возникли вопросы или проблемы:
- Создайте [Issue](https://github.com/RockInMyHead/WindexsChat2.0/issues) на GitHub
- Проверьте [документацию по API](API_SETUP.md)

---

**Разработано с ❤️ для создания лучшего AI-ассистента**
