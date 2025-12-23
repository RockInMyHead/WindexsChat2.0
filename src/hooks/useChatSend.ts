import { useState, useRef, useCallback, useEffect } from 'react';
import { sendChatMessage, type PlanStep, type TokenCost, detectWebsiteIntent, generateWebsiteArtifact } from '@/lib/openai';
import { apiClient, type Message, type Artifact } from '@/lib/api';
import { type MarketQuote, type MarketChart } from '@/lib/market';

// Throttling utility for streaming updates
const throttle = <T extends any[]>(func: (...args: T) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return (...args: T) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

interface MarketWidgetState {
  quote: MarketQuote;
  chart: MarketChart;
  vs: string;
  range: "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";
}

interface UseChatSendOptions {
  sessionId: number | null;
  selectedModel: string;
  internetEnabled: boolean;
  user?: User;
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void;
  setArtifacts: (updater: (prev: Map<number, Artifact>) => Map<number, Artifact>) => void;
  onMarketWidgetUpdate: (widget: MarketWidgetState | null) => void;
  onThinkingUpdate: (messages: string[]) => void;
  onPlanningUpdate: (plan: PlanStep[], currentStep: number, isPlanning: boolean) => void;
  onSearchProgress: (queries: string[]) => void;
  onTokenCost: (cost: TokenCost) => void;
  onScrollToBottom: () => void;
}

interface UseChatSendReturn {
  isLoading: boolean;
  isSending: boolean;
  abortController: AbortController | null;
  sendMessage: (messageText: string, messages: Message[]) => Promise<void>;
  abortCurrentRequest: () => void;
}

export const useChatSend = ({
  sessionId,
  selectedModel,
  internetEnabled,
  user,
  onMessageUpdate,
  onArtifactCreated,
  onMarketWidgetUpdate,
  onThinkingUpdate,
  onPlanningUpdate,
  onSearchProgress,
  onTokenCost,
  onScrollToBottom,
}: UseChatSendOptions): UseChatSendReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  // Throttled message update for streaming
  const throttledMessageUpdate = useCallback(
    throttle((updater: (prev: Message[]) => Message[]) => {
      onMessageUpdate(updater);
    }, 50), // Update UI every 50ms max
    [onMessageUpdate]
  );

  // Throttled scroll to bottom
  const throttledScrollToBottom = useCallback(
    throttle(() => {
      onScrollToBottom();
    }, 100), // Scroll every 100ms max
    [onScrollToBottom]
  );

  const abortCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('Aborting current request...');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    isSendingRef.current = false;
  }, []);

  // Generate chat title using simple text truncation (production-ready)
  const generateChatTitle = useCallback(async (userMessage: string, sessionId: number) => {
    try {
      // Simple text truncation - production ready approach
      const newTitle = userMessage.length > 50
        ? userMessage.substring(0, 47) + "..."
        : userMessage;

      if (newTitle && newTitle.trim().length > 0) {
        await apiClient.updateSessionTitle(sessionId, newTitle.trim());
      }
    } catch (error) {
      console.error('Failed to update chat title:', error);
    }
  }, []);

  const detectMarketIntent = useCallback((text: string) =>
    /\b(курс|цена|котировк|биткоин|bitcoin|btc|график|chart)\b/i.test(text),
  []);

  const sendMessage = useCallback(async (messageText: string, currentMessages: Message[]) => {
    console.log('🚀 sendMessage called with:', messageText, 'sessionId:', sessionId);

    // Сбрасываем market widget по умолчанию
    onMarketWidgetUpdate(null);

    // Определяем sessionId для использования (избегаем race condition)
    let sessionIdToUse = sessionId;

    // Если сессия не существует, создаем новую
    if (!sessionIdToUse) {
      try {
        console.log('No session found, creating new session...');
        const title = messageText.length > 50 ? messageText.substring(0, 47) + "..." : messageText;
        const { sessionId: newSessionId } = await apiClient.createSession(title);
        console.log('New session created with ID:', newSessionId);
        sessionIdToUse = newSessionId;
        // Note: sessionId update should be handled by parent component
      } catch (error) {
        console.error('Failed to create session:', error);
        return;
      }
    }

    if (!messageText.trim() || isLoading || isSendingRef.current) {
      console.log('🚫 sendMessage blocked:', {
        hasText: !!messageText.trim(),
        textLength: messageText.length,
        isLoading,
        isSending: isSendingRef.current,
        sessionIdToUse,
        abortControllerExists: !!abortControllerRef.current
      });
      return;
    }

    // Устанавливаем флаг отправки
    isSendingRef.current = true;

    const userMessage: Message = { role: "user", content: messageText, timestamp: Date.now() };
    const systemMessage = {
      role: "system" as const,
      content: "Ты полезный AI-ассистент. Каждый чат является полностью независимым и изолированным. Не используй информацию или контекст из других разговоров. Отвечай только на основе предоставленных сообщений в текущем чате.",
      timestamp: Date.now()
    };

    // Ограничиваем контекст до последних 20 сообщений
    const MAX_CONTEXT_MESSAGES = 20;
    const recentMessages = currentMessages.length > MAX_CONTEXT_MESSAGES
      ? currentMessages.slice(-MAX_CONTEXT_MESSAGES)
      : currentMessages;

    // Ограничиваем размер каждого сообщения
    const MAX_MESSAGE_SIZE = 50 * 1024; // 50KB
    const truncateMessage = (content: string) => {
      if (content.length > MAX_MESSAGE_SIZE) {
        console.warn(`Message too large (${content.length} chars), truncating to ${MAX_MESSAGE_SIZE} chars`);
        return content.substring(0, MAX_MESSAGE_SIZE) + '\n\n[Сообщение сокращено из-за превышения лимита размера]';
      }
      return content;
    };

    systemMessage.content = truncateMessage(systemMessage.content);
    userMessage.content = truncateMessage(userMessage.content);
    const processedMessages = recentMessages.map(msg => ({
      ...msg,
      content: truncateMessage(msg.content)
    }));

    const allMessages = [systemMessage, ...processedMessages, userMessage] as any[];

    // Сохраняем только пользовательское сообщение в состоянии
    onMessageUpdate(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Принудительная прокрутка при начале ответа
    setTimeout(() => throttledScrollToBottom(), 100);

    try {
      // Проверяем, хочет ли пользователь создать сайт
      const isWebsiteRequest = detectWebsiteIntent(messageText);
      console.log('🔍 Website intent detection:', { messageText, isWebsiteRequest });

      if (isWebsiteRequest) {
        console.log('🎯 WEBSITE REQUEST DETECTED - will generate artifact');

        try {
          console.log('🔧 Calling generateWebsiteArtifact...');
          const { artifact, assistantText } = await generateWebsiteArtifact(
            messageText,
            selectedModel
          );
          console.log('✅ generateWebsiteArtifact succeeded, artifact title:', artifact.title);

          // Сохраняем артефакт в базу данных
          const { artifactId } = await apiClient.createArtifact(
            sessionIdToUse,
            'website',
            artifact.title,
            artifact.files,
            artifact.deps
          );

          console.log('✅ Artifact created with ID:', artifactId);

          // Создаем полноценный объект Artifact для немедленного отображения
          const createdArtifact: Artifact = {
            id: artifactId,
            sessionId: sessionIdToUse,
            type: 'website',
            title: artifact.title,
            files: artifact.files,
            deps: artifact.deps,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          // Сообщаем наверх — пусть владелец состояния обновит Map
          try {
            onArtifactCreated?.(createdArtifact);
          } catch (e) {
            console.error("❌ onArtifactCreated handler failed:", e);
          }

          // Создаем сообщение ассистента с артефактом
          const assistantMessage = {
            role: 'assistant' as const,
            content: assistantText,
            timestamp: Date.now(),
            artifactId: artifactId
          };

          onMessageUpdate(prev => [...prev, assistantMessage]);

          // Сохраняем сообщение ассистента с привязкой к артефакту
          await apiClient.saveMessage(sessionIdToUse, 'assistant', assistantText, artifactId);

          return;
        } catch (artifactError) {
          console.error('❌ Failed to generate artifact:', artifactError);
          const errorMessage = "Извините, не удалось создать веб-сайт. Попробуйте переформулировать запрос или попробуйте снова.";
          onMessageUpdate(prev => [...prev, {
            role: 'assistant',
            content: errorMessage,
            timestamp: Date.now()
          }]);
          await apiClient.saveMessage(sessionIdToUse, 'assistant', errorMessage);
          return;
        }
      }

      // Очищаем промежуточные сообщения и состояния
      onThinkingUpdate([]);
      onPlanningUpdate([], -1, false);
      onSearchProgress([]);

      // Создаем новый AbortController для этого запроса
      const controller = new window.AbortController();
      abortControllerRef.current = controller;

      let assistantContent = "";
      let hasStartedAssistantMessage = false;

      // Включаем market widget если запрос касается рынка
      if (internetEnabled && detectMarketIntent(messageText)) {
        console.log('Market intent detected, loading market data...');
        try {
          const quote = await apiClient.get<MarketQuote>("/api/market/quote?vs=usd");
          const chart = await apiClient.get<MarketChart>("/api/market/chart?vs=usd&days=1");

          onMarketWidgetUpdate({
            quote,
            chart,
            vs: "usd",
            range: "1D"
          });
          console.log('Market widget data loaded successfully');
        } catch (error) {
          console.error('Failed to load market data:', error);
        }
      }

      console.log('About to call sendChatMessage with messages:', allMessages.length, 'selectedModel:', selectedModel);
      await sendChatMessage(
        allMessages as import("@/lib/openai").Message[],
        selectedModel,
        (chunk: string) => {
          assistantContent += chunk;

          if (!hasStartedAssistantMessage) {
            throttledMessageUpdate((prev) => [
              ...prev,
              { role: "assistant", content: assistantContent, timestamp: Date.now() },
            ]);
            hasStartedAssistantMessage = true;
          } else {
            throttledMessageUpdate((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].content = assistantContent;
              return newMessages;
            });
          }

          throttledScrollToBottom();
        },
        // Колбэк для генерации плана
        (plan: PlanStep[]) => {
          onPlanningUpdate(plan, -1, true);
          if (plan.length > 0) {
            const planText = `📋 Создан план из ${plan.length} шагов:\n` +
              plan.map((step, idx) => `${idx + 1}. ${step.step}`).join('\n');
            onThinkingUpdate([planText]);
          }
        },
        // Колбэк для начала выполнения этапа
        (stepIndex: number, step: PlanStep) => {
          onPlanningUpdate([], stepIndex, false);
        },
        // Колбэк для прогресса поиска
        (queries: string[]) => {
          onSearchProgress(queries);
          if (queries.length > 0) {
            onThinkingUpdate(prev => {
              const newQueries = queries.filter(q => !prev.some(msg => msg.includes(`"${q}"`)));
              if (newQueries.length > 0) {
                return [
                  ...prev,
                  ...newQueries.map(q => `🔍 Поиск: "${q}"`)
                ];
              }
              return prev;
            });
          }
        },
        // internetEnabled (важный параметр - должен быть boolean!)
        internetEnabled,
        // Колбэк для стоимости токенов
        (cost: TokenCost) => {
          onTokenCost(cost);
        },
        controller.signal,
        user?.id,
        sessionIdToUse
      );

      // Сохраняем сообщение пользователя в базу данных
      console.log('Saving user message to database...');
      await apiClient.saveMessage(sessionIdToUse, "user", messageText);

      // Если это первое сообщение пользователя в чате, генерируем заголовок
      if (currentMessages.length === 0 && sessionIdToUse) {
        await generateChatTitle(messageText, sessionIdToUse);
      }

      // Сохраняем сообщение ассистента в базу данных
      console.log('Saving assistant message to database...');
      await apiClient.saveMessage(sessionIdToUse, "assistant", assistantContent);

    } catch (error: any) {
      console.error('Error in sendMessage:', error);

      // Обрабатываем прерывание запроса
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }

      // Показываем ошибку пользователю
      const errorMessage = error.message || 'Произошла ошибка при отправке сообщения';
      onMessageUpdate(prev => [...prev, {
        role: 'assistant',
        content: `❌ ${errorMessage}`,
        timestamp: Date.now()
      }]);

      // Сохраняем сообщение об ошибке
      if (sessionIdToUse) {
        try {
          await apiClient.saveMessage(sessionIdToUse, 'assistant', `❌ ${errorMessage}`);
        } catch (saveError) {
          console.error('Failed to save error message:', saveError);
        }
      }
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [
    sessionId,
    selectedModel,
    internetEnabled,
    isLoading,
    onMessageUpdate,
    onArtifactCreated,
    onMarketWidgetUpdate,
    onThinkingUpdate,
    onPlanningUpdate,
    onSearchProgress,
    onTokenCost,
    throttledMessageUpdate,
    throttledScrollToBottom,
    generateChatTitle,
    detectMarketIntent,
  ]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      abortCurrentRequest();
    };
  }, [abortCurrentRequest]);

  return {
    isLoading,
    isSending: isSendingRef.current,
    abortController: abortControllerRef.current,
    sendMessage,
    abortCurrentRequest,
  };
};
