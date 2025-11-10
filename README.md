# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/6ab196ea-1cd5-4cee-9b1c-ac315c00cd70

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/6ab196ea-1cd5-4cee-9b1c-ac315c00cd70) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

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

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/6ab196ea-1cd5-4cee-9b1c-ac315c00cd70) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
