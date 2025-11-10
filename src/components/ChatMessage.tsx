import { useMemo } from "react";
import DataVisualization, { parseVisualizationConfig, VisualizationConfig } from "./DataVisualization";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessageProps {
  message: Message;
}

// Компонент для отображения блоков кода
const CodeBlock = ({ code, language }: { code: string; language?: string }) => {
  return (
    <div className="relative my-4 rounded-lg bg-gray-900 text-gray-100 overflow-hidden">
      {/* Заголовок с языком */}
      {language && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-300">{language}</span>
          <button
            className="text-gray-400 hover:text-gray-200 transition-colors"
            onClick={() => navigator.clipboard.writeText(code)}
            title="Копировать код"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      )}

      {/* Блок кода */}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-gray-100 whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
};

// Функция для парсинга текста с блоками кода
const parseTextWithCodeBlocks = (text: string) => {
  if (!text) return [{ type: 'text', content: '' }];

  const parts = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Добавляем текст до блока кода
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push({ type: 'text', content: textBefore });
      }
    }

    // Добавляем блок кода
    const language = match[1] || 'text';
    const code = match[2].trim();
    parts.push({ type: 'code', language, content: code });

    lastIndex = match.index + match[0].length;
  }

  // Добавляем оставшийся текст после последнего блока кода
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim()) {
      parts.push({ type: 'text', content: remainingText });
    }
  }

  return parts;
};

// Компонент для рендеринга текста с блоками кода
const TextWithCodeBlocks = ({ text }: { text: string }) => {
  const parts = parseTextWithCodeBlocks(text);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} code={part.content} language={part.language} />;
        } else {
          return (
            <div key={index} className="prose prose-sm max-w-none whitespace-pre-wrap">
              {part.content}
            </div>
          );
        }
      })}
    </>
  );
};

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === "user";

  // Парсим конфигурацию визуализации из текста сообщения
  const visualizationConfig = useMemo(() => {
    if (isUser) return null; // Визуализации только в сообщениях AI
    return parseVisualizationConfig(message.content);
  }, [message.content, isUser]);

  // Разделяем текст на части до и после визуализации
  const messageParts = useMemo(() => {
    if (!visualizationConfig) return [message.content];

    // Ищем ВСЕ JSON блоки и берем ПОСЛЕДНИЙ для разделения
    const jsonMatches = Array.from(message.content.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g));

    if (jsonMatches.length > 0) {
      const lastMatch = jsonMatches[jsonMatches.length - 1];
      const matchIndex = lastMatch.index;
      const matchLength = lastMatch[0].length;

      // Разделяем текст до и после последнего JSON блока
      const beforeJson = message.content.substring(0, matchIndex).trim();
      const afterJson = message.content.substring(matchIndex + matchLength).trim();

      // Если текст до JSON содержит только описание визуализации, не показываем его
      const cleanBeforeJson = beforeJson
        .replace(/^(Вот визуализация данных?:?|Визуализация:?|График:?|Диаграмма:?)/i, '')
        .trim();

      return [cleanBeforeJson, afterJson].filter(Boolean);
    }

    return [message.content];
  }, [message.content, visualizationConfig]);

  return (
    <div className={`flex items-start gap-4 mb-6 animate-fade-in ${
      isUser ? "justify-end" : "justify-start"
    }`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0">
          AI
        </div>
      )}
      <div className={`flex-1 pt-1 ${isUser ? "max-w-[70%]" : "max-w-[80%]"}`}>
        <div className={`rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground ml-auto"
            : "bg-secondary text-secondary-foreground"
        }`}>
          {/* Если есть визуализация, показываем текст до/после */}
          {visualizationConfig ? (
            <>
              {/* Текст до визуализации */}
              {messageParts[0] && (
                <div className="mb-4">
                  <TextWithCodeBlocks text={messageParts[0]} />
                </div>
              )}

              {/* Визуализация */}
              <div className="my-4">
                <DataVisualization config={visualizationConfig} />
              </div>

              {/* Текст после визуализации */}
              {messageParts[1] && (
                <div className="mt-4">
                  <TextWithCodeBlocks text={messageParts[1]} />
                </div>
              )}
            </>
          ) : (
            /* Если нет визуализации, показываем весь текст */
            <TextWithCodeBlocks text={message.content} />
          )}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold shrink-0">
          Вы
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
