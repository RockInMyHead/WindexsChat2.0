import { useMemo, useState, useRef } from "react";
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
    <div className="relative my-4 rounded-lg bg-gray-900 text-gray-100 w-full max-w-full overflow-hidden">
      {/* Заголовок с языком */}
      {language && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 sm:px-4">
          <span className="text-xs sm:text-sm font-medium text-gray-300 truncate">{language}</span>
          <button
            className="text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0 ml-2"
            onClick={() => navigator.clipboard.writeText(code)}
            title="Копировать код"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      )}

      {/* Блок кода с адаптивными настройками */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <pre className="p-3 text-xs sm:text-sm leading-relaxed min-w-0 sm:p-4">
          <code className="font-mono text-gray-100 block whitespace-pre-wrap break-words overflow-wrap-anywhere">
            {code}
          </code>
        </pre>
      </div>
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Функция для генерации и воспроизведения TTS
  const handleTTS = async () => {
    if (isPlaying) {
      // Останавливаем воспроизведение
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);

    try {
      // Получаем текст для озвучки (убираем блоки кода из текста)
      const textToSpeak = message.content.replace(/```[\s\S]*?```/g, '').trim();

      if (!textToSpeak) {
        alert('Нет текста для озвучки');
        setIsLoading(false);
        return;
      }

      // Отправляем запрос к OpenAI TTS API
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: textToSpeak,
          voice: 'alloy', // Можно выбрать: alloy, echo, fable, onyx, nova, shimmer
          response_format: 'mp3',
          speed: 1.0
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      // Получаем аудио данные
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Создаем аудио элемент и воспроизводим
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        alert('Ошибка воспроизведения аудио');
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setIsPlaying(true);

    } catch (error) {
      console.error('TTS error:', error);
      alert('Ошибка генерации речи. Проверьте API ключ и подключение.');
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
            AI
          </div>
          {/* Кнопка озвучки */}
          <button
            onClick={handleTTS}
            disabled={isLoading}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              isPlaying
                ? 'bg-red-500 text-white hover:bg-red-600'
                : isLoading
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            title={isPlaying ? 'Остановить озвучку' : 'Озвучить сообщение'}
          >
            {isLoading ? (
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
            ) : isPlaying ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
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
