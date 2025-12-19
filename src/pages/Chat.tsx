import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, Square, Paperclip } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatMessage from "@/components/ChatMessage";
import ChatHeader from "@/components/ChatHeader";
import { ChatSidebar } from "@/components/ChatSidebar";
import { TokenCostDisplay } from "@/components/TokenCostDisplay";
import { BtcWidget } from "@/components/BtcWidget";
import { WebsiteArtifactCard } from "@/components/WebsiteArtifactCard";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendChatMessage, type PlanStep, type TokenCost, detectWebsiteIntent, generateWebsiteArtifact } from "@/lib/openai";
import { apiClient, type Message, type Artifact } from "@/lib/api";
import { FileProcessor } from "@/lib/fileProcessor";
import { useAuth } from "@/contexts/AuthContext";
import { type MarketQuote, type MarketChart } from "@/lib/market";

// Типы для market widget
type MarketWidgetState = {
  quote: MarketQuote;
  chart: MarketChart;
  vs: string;
  range: "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";
};

// Типы для Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechGrammarList {
  readonly length: number;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
  addFromURI(src: string, weight?: number): void;
  addFromString(string: string, weight?: number): void;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare const webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

const Chat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { initialChatMessage, setInitialChatMessage } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("lite");
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [responsePlan, setResponsePlan] = useState<PlanStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isPlanning, setIsPlanning] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string[]>([]);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const [lastTokenCost, setLastTokenCost] = useState<TokenCost | null>(null);
  const [marketWidget, setMarketWidget] = useState<MarketWidgetState | null>(null);
  const [internetEnabled, setInternetEnabled] = useState<boolean>(() => {
    // Загружаем настройку из localStorage
    const saved = localStorage.getItem('windexsai-internet-enabled');
    return saved !== null ? JSON.parse(saved) : true; // По умолчанию включено
  });
  
  // Состояние для артефактов
  const [artifacts, setArtifacts] = useState<Map<number, Artifact>>(new Map());

  // AbortController для прерывания запросов
  const abortControllerRef = useRef<AbortController | null>(null);
  // Флаг для предотвращения одновременных отправок
  const isSendingRef = useRef(false);

  // Функция для переключения интернет-поиска
  const handleToggleInternet = () => {
    const newValue = !internetEnabled;
    setInternetEnabled(newValue);
    localStorage.setItem('windexsai-internet-enabled', JSON.stringify(newValue));
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialMessageSentRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Инициализация сессии и загрузка сообщений
  useEffect(() => {
    const initializeSession = async () => {

      // Проверяем, есть ли initialMessage
      const initialMessage = initialChatMessage || location.state?.initialMessage;

      if (!currentSessionId || initialMessage) {
        try {
          // Если есть initialMessage, всегда создаем новый чат
          if (initialMessage) {
            console.log('Creating new session for initial message...');
            // Создаем новую сессию с заголовком на основе первого сообщения
            const title = initialMessage.length > 50 ? initialMessage.substring(0, 47) + "..." : initialMessage;
            const { sessionId } = await apiClient.createSession(title);
            console.log('Session created with ID:', sessionId, 'title:', title);
            setCurrentSessionId(sessionId);

            // Отправляем initialMessage как первое сообщение
            setTimeout(() => {
              sendMessage(initialMessage);
              // Очищаем initialMessage после использования
              setInitialChatMessage(null);
              // Также очищаем location.state если он был использован
              if (window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            }, 100);
          } else if (!currentSessionId) {
            console.log('Creating new empty session...');
            // Создаем новую пустую сессию
            const { sessionId } = await apiClient.createSession("Новый чат");
            console.log('Session created with ID:', sessionId);
            setCurrentSessionId(sessionId);
          } else {
            // Загружаем существующие сообщения
            console.log('Loading existing session messages...');
            const savedMessages = await apiClient.getMessages(currentSessionId);
            setMessages(savedMessages);
          }
        } catch (error) {
          console.error('Error initializing session:', error);
        }
      }
    };

    initializeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, initialChatMessage, location.state?.initialMessage]);


  // Прокрутка при добавлении новых сообщений (только если пользователь не прокручивает)
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Умная прокрутка - только если пользователь не прокручивает вручную
  const scrollToBottom = (force = false) => {
    if (!messagesEndRef.current) return;

    const container = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]');
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px от низа

    // Прокручиваем только если пользователь у низа или принудительно
    if (force || (isNearBottom && !isUserScrollingRef.current)) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Отслеживаем пользовательскую прокрутку
  useEffect(() => {
    const container = messagesEndRef.current?.closest('[data-radix-scroll-area-viewport]');
    if (!container) return;

    const handleScroll = () => {
      isUserScrollingRef.current = true;

      // Сбрасываем флаг пользовательской прокрутки через 2 секунды
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 2000);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Очистка ресурсов при размонтировании
  useEffect(() => {
    return () => {
      FileProcessor.cleanup();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Детектор market запросов
  const isMarketIntent = (text: string) =>
    /\b(курс|цена|котировк|биткоин|bitcoin|btc|график|chart)\b/i.test(text);

  // Загрузка артефакта по ID
  const loadArtifact = async (artifactId: number) => {
    try {
      const artifact = await apiClient.getArtifact(artifactId);
      setArtifacts(prev => new Map(prev).set(artifactId, artifact));
      return artifact;
    } catch (error) {
      console.error('Failed to load artifact:', error);
      return null;
    }
  };

  const sendMessage = async (messageText: string) => {
    console.log('sendMessage called with:', messageText, 'currentSessionId:', currentSessionId);
    console.log('sendMessage - internetEnabled:', internetEnabled);
    console.log('sendMessage - localStorage internet-enabled:', localStorage.getItem('windexsai-internet-enabled'));

    // Сбрасываем market widget по умолчанию
    setMarketWidget(null);

    // Если сессия не существует, создаем новую
    if (!currentSessionId) {
      try {
        console.log('No session found, creating new session...');
        const title = messageText.length > 50 ? messageText.substring(0, 47) + "..." : messageText;
        const { sessionId } = await apiClient.createSession(title);
        console.log('New session created with ID:', sessionId);
        setCurrentSessionId(sessionId);
        // Ждем немного, чтобы состояние обновилось
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Failed to create session:', error);
        return;
      }
    }

    if (!messageText.trim() || isLoading || isSendingRef.current) {
      console.log('sendMessage blocked after session check:', { messageText: !!messageText.trim(), isLoading, currentSessionId, isSending: isSendingRef.current });
      return;
    }

    // Устанавливаем флаг отправки
    isSendingRef.current = true;

    const userMessage: Message = { role: "user", content: messageText, timestamp: Date.now() };
    // Системное сообщение для OpenAI (без сохранения в БД)
    const systemMessage = {
      role: "system" as const,
      content: "Ты полезный AI-ассистент. Каждый чат является полностью независимым и изолированным. Не используй информацию или контекст из других разговоров. Отвечай только на основе предоставленных сообщений в текущем чате.",
      timestamp: Date.now()
    };
    const allMessages = [systemMessage, ...messages, userMessage] as any[];

    // Сохраняем только пользовательское сообщение в состоянии (без системного)
    setMessages([...messages, userMessage]);
    setInput("");
    setIsLoading(true);

    // Принудительная прокрутка при начале ответа
    setTimeout(() => {
      scrollToBottom(true);
    }, 100);

    // Сбрасываем состояние плана для нового сообщения
    setResponsePlan([]);
    setCurrentStep(-1);
    setIsPlanning(false);

    // Сохраняем сообщение пользователя в базу данных
    console.log('Saving user message to database...');
    await apiClient.saveMessage(currentSessionId, "user", messageText);

    // Если это первое сообщение пользователя в чате, генерируем заголовок
    if (messages.length === 0 && currentSessionId) {
      await generateChatTitle(messageText, currentSessionId);
    }

    console.log('Message saved, calling sendChatMessage...');

    try {
      // Проверяем, хочет ли пользователь создать сайт
      const isWebsiteRequest = detectWebsiteIntent(messageText);
      
      if (isWebsiteRequest) {
        console.log('🎨 Website intent detected, generating artifact...');
        
        try {
          // Генерируем артефакт через OpenAI
          const { artifact, assistantText } = await generateWebsiteArtifact(
            messageText,
            selectedModel
          );
          
          // Сохраняем артефакт в базу данных
          const { artifactId } = await apiClient.createArtifact(
            currentSessionId,
            'website',
            artifact.title,
            artifact.files,
            artifact.deps
          );
          
          console.log('✅ Artifact created with ID:', artifactId);
          
          // Загружаем артефакт в состояние
          const createdArtifact = await loadArtifact(artifactId);
          
          // Добавляем сообщение ассистента с артефактом
          const assistantMessage = {
            role: 'assistant' as const,
            content: assistantText,
            timestamp: Date.now(),
            artifactId: artifactId
          };
          
          setMessages(prev => [...prev, assistantMessage]);
          
          // Сохраняем сообщение ассистента с привязкой к артефакту
          await apiClient.saveMessage(currentSessionId, 'assistant', assistantText, artifactId);
          
          return; // Выходим из функции, не вызывая обычный чат
          
        } catch (artifactError) {
          console.error('❌ Failed to generate artifact:', artifactError);
          // Если генерация артефакта не удалась, продолжаем с обычным ответом
          const errorMessage = "Извините, не удалось создать веб-сайт. Попробуйте переформулировать запрос или попробуйте снова.";
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: errorMessage,
            timestamp: Date.now()
          }]);
          await apiClient.saveMessage(currentSessionId, 'assistant', errorMessage);
          return;
        }
      }

      // Очищаем промежуточные сообщения и состояния
      setThinkingMessages([]);
      setResponsePlan([]);
      setCurrentStep(-1);
      setIsPlanning(false);
      setSearchProgress([]);
      setLastTokenCost(null);

      // Создаем новый AbortController для этого запроса
      abortControllerRef.current = new AbortController();

      let assistantContent = "";
      let hasStartedAssistantMessage = false;

      // Включаем market widget если запрос касается рынка
      if (internetEnabled && isMarketIntent(messageText)) {
        console.log('Market intent detected, loading market data...');
        try {
          const quote = await apiClient.get<MarketQuote>("/api/market/quote?vs=usd");
          const chart = await apiClient.get<MarketChart>("/api/market/chart?vs=usd&days=1");

          setMarketWidget({
            quote,
            chart,
            vs: "usd",
            range: "1D"
          });
          console.log('Market widget data loaded successfully');
        } catch (error) {
          console.error('Failed to load market data:', error);
          // Не показываем ошибку пользователю, просто не показываем виджет
        }
      }

      console.log('About to call sendChatMessage with messages:', allMessages.length, 'selectedModel:', selectedModel);
      await sendChatMessage(
        allMessages as import("@/lib/openai").Message[],
        selectedModel,
        (chunk: string) => {
          assistantContent += chunk;

          if (!hasStartedAssistantMessage) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: assistantContent, timestamp: Date.now() },
            ]);
            hasStartedAssistantMessage = true;
          } else {
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].content = assistantContent;
              return newMessages;
            });
          }

          // Умная прокрутка только если пользователь у низа
          setTimeout(() => {
            scrollToBottom();
          }, 10);
        },
        // Колбэк для генерации плана
        (plan: PlanStep[]) => {
          setResponsePlan(plan);
          setIsPlanning(true);
          if (plan.length > 0) {
            // Показываем план в чате
            const planText = `📋 Создан план из ${plan.length} шагов:\n` +
              plan.map((step, idx) => `${idx + 1}. ${step.step}`).join('\n');
            setThinkingMessages([planText]);
          }
        },
        // Колбэк для начала выполнения этапа
        (stepIndex: number, step: PlanStep) => {
          setCurrentStep(stepIndex);
          setIsPlanning(false);
        },
        // Колбэк для прогресса поиска
        (queries: string[]) => {
          setSearchProgress(queries);
          if (queries.length > 0) {
            // Показываем реальные поисковые запросы в чате
            setThinkingMessages(prev => {
              const newQueries = queries.filter(q => !prev.some(msg => msg.includes(`"${q}"`)));
              if (newQueries.length > 0) {
                const queryMessages = newQueries.map(q => `🔍 Поиск: "${q}"`);
                return [...prev, ...queryMessages];
              }
              return prev;
            });
          }
        },
        // Настройка интернет-поиска
        internetEnabled,
        // AbortSignal для прерывания запроса
        abortControllerRef.current?.signal,
        // Обработчик стоимости токенов
        (tokenCost: TokenCost) => {
          setLastTokenCost(tokenCost);
          console.log('💰 Token cost received:', tokenCost);
        }
      );

      // Сохраняем ответ ассистента в базу данных
      if (assistantContent) {
        await apiClient.saveMessage(currentSessionId, "assistant", assistantContent);
      }

      // Сбрасываем состояния плана после завершения ответа
      setResponsePlan([]);
      setCurrentStep(-1);
      setIsPlanning(false);
      setSearchProgress([]);
      setThinkingMessages([]);
    } catch (error) {
      // Проверяем, было ли прервано выполнение
      if (error.name === 'AbortError') {
        console.log('Request was aborted by user');
        // Не показываем ошибку пользователю при прерывании
      } else {
        console.error("Error in sendMessage:", error);
        console.log("Error details:", error.message, error.stack);
        const errorMessage = "Извините, произошла ошибка. Пожалуйста, попробуйте снова.";

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: errorMessage,
            timestamp: Date.now(),
          },
        ]);

        // Сохраняем сообщение об ошибке в базу данных
        await apiClient.saveMessage(currentSessionId, "assistant", errorMessage);
      }

      // Сбрасываем состояние плана при ошибке
      setResponsePlan([]);
      setCurrentStep(-1);
      setIsPlanning(false);
      setSearchProgress([]);
      setThinkingMessages([]);
      setLastTokenCost(null);
    } finally {
      console.log("sendMessage finished, setting isLoading to false");
      setIsLoading(false);
      // Сбрасываем флаги
      isSendingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!isLoading && !isSendingRef.current && messageText) {
      sendMessage(messageText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Получаем значение напрямую из textarea, так как onChange может еще не обновить состояние
      const currentValue = e.currentTarget.value.trim();
      if (currentValue && !isLoading && !isSendingRef.current) {
        sendMessage(currentValue);
        setInput(""); // Очищаем поле после отправки
      }
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем, поддерживается ли тип файла
    if (!FileProcessor.isSupportedFileType(file)) {
      alert(`Неподдерживаемый тип файла.\n${FileProcessor.getSupportedFileTypesDescription()}`);
      return;
    }

    // Проверяем размер файла (макс 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('Файл слишком большой. Максимальный размер: 10MB');
      return;
    }

    setIsProcessingFile(true);

    try {
      // Обрабатываем файл
      const processedFile = await FileProcessor.processFile(file);

      if (processedFile.success && processedFile.text.trim()) {
        // Создаем сообщение с содержимым файла
        const fileMessage = `📄 **${processedFile.fileName}**\n\n${processedFile.text}`;

        // Автоматически отправляем сообщение с содержимым файла
        await sendMessage(`Проанализируй этот документ и дай краткое содержание:\n\n${fileMessage}`);
      } else {
        // Показываем ошибку
        alert(processedFile.error || 'Не удалось обработать файл');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Произошла ошибка при обработке файла');
    } finally {
      setIsProcessingFile(false);
      // Сбрасываем input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    // Инициализация Speech Recognition API
    const windowWithSpeech = window as typeof window & {
      SpeechRecognition?: typeof SpeechRecognition;
      webkitSpeechRecognition?: typeof webkitSpeechRecognition;
    };

    if (typeof window !== 'undefined' && (windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition)) {
      const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'ru-RU'; // Основной язык - русский

      recognitionInstance.onstart = () => {
        setIsRecording(true);
        console.log('Voice recording started');
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
        console.log('Voice recording ended');
      };

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice transcript:', transcript);

        if (transcript.trim()) {
          // Отправляем распознанный текст как сообщение
          sendMessage(transcript.trim());
        }
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);

        // Показываем ошибку пользователю
        if (event.error === 'not-allowed') {
          alert('Для голосового ввода необходимо разрешить доступ к микрофону');
        } else if (event.error === 'no-speech') {
          alert('Речь не обнаружена. Попробуйте еще раз.');
        } else {
          alert('Ошибка распознавания речи: ' + event.error);
        }
      };

      setRecognition(recognitionInstance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVoiceRecord = () => {
    if (!recognition) {
      alert('Голосовой ввод не поддерживается в этом браузере');
      return;
    }

    if (isRecording) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting voice recognition:', error);
        alert('Не удалось начать запись голоса');
      }
    }
  };

  const handleNewChat = async () => {
    try {
      // Прерываем текущий запрос, если он есть
      if (abortControllerRef.current) {
        console.log('Aborting current request...');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Очищаем все состояние перед созданием нового чата
      setMessages([]);
      setResponsePlan([]);
      setCurrentStep(-1);
      setIsPlanning(false);
      setSearchProgress([]);
      setIsLoading(false); // Сбрасываем состояние загрузки
      isSendingRef.current = false; // Сбрасываем флаг отправки
      setMarketWidget(null); // Сбрасываем market widget
      setArtifacts(new Map()); // Очищаем артефакты

      // Создаем новую сессию
      const { sessionId: newSessionId } = await apiClient.createSession("Новый чат");
      setCurrentSessionId(newSessionId);

      // Обновляем sidebar для отображения новой сессии
      setSidebarRefreshTrigger(prev => prev + 1);
      // Очищаем input поле
      setInput("");

      console.log('New chat created with sessionId:', newSessionId);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleSelectChat = async (sessionId: number) => {
    if (isLoading || currentSessionId === sessionId) return; // Предотвращаем одновременные операции и перезагрузку того же чата

    try {
      // Очищаем состояние перед загрузкой нового чата
      setResponsePlan([]);
      setCurrentStep(-1);
      setIsPlanning(false);
      initialMessageSentRef.current = false;
      setMarketWidget(null); // Сбрасываем market widget
      setArtifacts(new Map()); // Очищаем артефакты

      setCurrentSessionId(sessionId);
      // Загружаем сообщения выбранного чата
      const chatMessages = await apiClient.getMessages(sessionId);
      setMessages(chatMessages);
      
      // Загружаем артефакты для сообщений, у которых есть artifactId
      const artifactIds = chatMessages
        .filter(msg => msg.artifactId)
        .map(msg => msg.artifactId as number);
      
      if (artifactIds.length > 0) {
        const uniqueArtifactIds = [...new Set(artifactIds)];
        await Promise.all(uniqueArtifactIds.map(loadArtifact));
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const generateChatTitle = async (userMessage: string, sessionId: number) => {
    try {
      // Генерируем заголовок на основе первого сообщения пользователя
      let title = userMessage.trim();

      // Убираем лишние пробелы и переносы строк
      title = title.replace(/\s+/g, ' ');

      // Ограничиваем длину заголовка (максимум 60 символов)
      if (title.length > 60) {
        // Ищем конец слова или предложения
        let cutIndex = 57;
        while (cutIndex > 40 && title[cutIndex] !== ' ' && title[cutIndex] !== '.' && title[cutIndex] !== '!' && title[cutIndex] !== '?') {
          cutIndex--;
        }
        if (cutIndex > 40) {
          title = title.substring(0, cutIndex) + "...";
        } else {
          title = title.substring(0, 57) + "...";
        }
      }

      // Если сообщение слишком короткое, используем общий заголовок
      if (title.length < 3) {
        title = "Новый чат";
      }

      // Обновляем заголовок в базе данных
      await apiClient.updateSessionTitle(sessionId, title);

      // Обновляем sidebar
      setSidebarRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error('Error generating chat title:', error);
      // В случае ошибки оставляем заголовок по умолчанию
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <ChatSidebar
          onSelectChat={handleSelectChat}
          currentSessionId={currentSessionId}
          refreshTrigger={sidebarRefreshTrigger}
          onChatDeleted={() => setSidebarRefreshTrigger(prev => prev + 1)}
        />

        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <ChatHeader
            onNewChat={handleNewChat}
            internetEnabled={internetEnabled}
            onToggleInternet={handleToggleInternet}
          />

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
            {messages.length === 0 && (
            <div className="text-center py-12 sm:py-20 animate-fade-in">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">
                WindexsAI
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Начните диалог, отправив сообщение
              </p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div key={index}>
              <ChatMessage message={message} selectedModel={selectedModel} />
              {/* Отображаем артефакт, если он есть у сообщения */}
              {message.artifactId && artifacts.has(message.artifactId) && (
                <WebsiteArtifactCard 
                  artifact={artifacts.get(message.artifactId)!}
                />
              )}
            </div>
          ))}

          {/* Отображение стоимости токенов */}
          {lastTokenCost && (
            <div className="mb-4">
              <TokenCostDisplay tokenCost={lastTokenCost} />
            </div>
          )}

          {/* Market Widget */}
          {marketWidget && (
            <div className="mb-6">
              <BtcWidget
                showChart={true}
                compact={false}
                defaultDays={marketWidget.range === "1D" ? 1 : marketWidget.range === "5D" ? 5 : marketWidget.range === "1M" ? 30 : 1}
              />
            </div>
          )}

          {/* Промежуточные сообщения работы LLM */}
          {thinkingMessages.map((thinkingMessage, index) => (
            <div key={`thinking-${index}`} className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                  <span className="text-white text-xs">💭</span>
                </div>
                <span className="text-sm text-blue-800 font-medium">{thinkingMessage}</span>
              </div>
            </div>
          ))}

          {/* Прогресс поиска в интернете */}
          {searchProgress.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50/80 border border-blue-200 rounded-lg animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs">🔍</span>
                </div>
                <span className="text-sm font-medium text-blue-800">
                  Поиск актуальной информации в интернете
                </span>
              </div>
              <div className="space-y-1.5">
                {searchProgress.map((query, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-blue-700">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="truncate">"{query}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Индикатор отключенного интернета */}
          {!internetEnabled && (
            <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200 rounded-lg animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                  <span className="text-white text-xs">⚠️</span>
                </div>
                <span className="text-sm text-amber-800">
                  Интернет-поиск отключен. AI отвечает только на основе своих знаний.
                </span>
              </div>
            </div>
          )}

          {/* План выполнения ответа */}
          {(responsePlan.length > 0 || isPlanning) && (
            <div className="mb-6 p-4 bg-gradient-to-r from-secondary/50 to-secondary/30 rounded-lg border border-secondary animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <span className="text-sm font-bold text-primary-foreground">📋</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    {isPlanning ? "Создание плана выполнения" : `План выполнения (${responsePlan.length} шагов)`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isPlanning ? "Анализирую ваш запрос и планирую действия..." : "Каждый шаг выполняется последовательно для лучшего результата"}
                  </p>
                </div>
              </div>

              {isPlanning ? (
                <div className="flex items-center gap-3 text-muted-foreground bg-background/50 p-3 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                  <span className="text-sm font-medium">Генерирую оптимальный план решения вашей задачи...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {responsePlan.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-4 p-4 rounded-lg transition-all duration-300 ${
                        index === currentStep
                          ? 'bg-primary/15 border-2 border-primary/30 shadow-md'
                          : step.completed
                            ? 'bg-green-50/80 border border-green-200/50'
                            : 'bg-background/60 border border-muted/30 hover:border-muted/50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mt-0.5 transition-all ${
                        index === currentStep
                          ? 'bg-primary text-primary-foreground shadow-lg animate-pulse'
                          : step.completed
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.completed ? '✓' : index === currentStep ? '⏳' : index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm mb-2 transition-colors ${
                          index === currentStep ? 'text-primary' :
                          step.completed ? 'text-green-700' : 'text-foreground'
                        }`}>
                          {step.step}
                        </div>
                        <div className="text-sm text-muted-foreground leading-relaxed">
                          {step.description}
                        </div>
                        {index === currentStep && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-primary font-medium">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            Выполняется сейчас...
                          </div>
                        )}
                        {step.completed && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            Шаг завершен
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-start gap-4 mb-6 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                AI
              </div>
              <div className="flex-1">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border bg-background flex-shrink-0 chat-input-area">
            <div className="max-w-3xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
              <div className="flex items-center gap-2 mb-3 overflow-x-auto">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[140px] sm:w-[200px] text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lite">
                      <div className="flex flex-col">
                        <span>WindexsAI Lite</span>
                        <span className="text-xs text-muted-foreground">
                          Базовый ИИ {internetEnabled ? "+ Интернет + Планирование" : ""}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pro">
                      <div className="flex flex-col">
                        <span>WindexsAI Pro</span>
                        <span className="text-xs text-muted-foreground">Продвинутый ИИ + Интернет + Планирование</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
                  {selectedModel === "pro" ? "Продвинутый ИИ" : `Базовый ИИ${internetEnabled ? " + Интернет" : ""}`}
                </span>
              </div>
              
              <form onSubmit={handleSubmit} className="flex gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 sm:h-[52px] sm:w-[52px] shrink-0"
                  onClick={handleFileUpload}
                  disabled={isLoading || isProcessingFile}
                  title={FileProcessor.getSupportedFileTypesDescription()}
                >
                  {isProcessingFile ? (
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-primary border-t-transparent" />
                  ) : (
                    <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
                
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Отправьте сообщение..."
                  className="min-h-[40px] sm:min-h-[52px] max-h-[200px] resize-none text-sm sm:text-base"
                  disabled={isLoading}
                />
                
                <Button
                  type={input.trim() ? "submit" : "button"}
                  size="icon"
                  className={`h-10 w-10 sm:h-[52px] sm:w-[52px] shrink-0 ${input.trim() ? "" : isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : ""}`}
                  disabled={isLoading}
                  onMouseDown={input.trim() ? undefined : (e) => {
                    e.preventDefault();
                    handleVoiceRecord();
                  }}
                  onMouseUp={input.trim() ? undefined : (e) => {
                    e.preventDefault();
                    if (isRecording && recognition) {
                      recognition.stop();
                    }
                  }}
                  onTouchStart={input.trim() ? undefined : (e) => {
                    e.preventDefault();
                    handleVoiceRecord();
                  }}
                  onTouchEnd={input.trim() ? undefined : (e) => {
                    e.preventDefault();
                    if (isRecording && recognition) {
                      recognition.stop();
                    }
                  }}
                  title={input.trim() ? "Отправить сообщение" :
                         isRecording ? "Отпустите для завершения записи" : "Удерживайте для голосового ввода"}
                >
                  {input.trim() ? (
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : isRecording ? (
                    <Square className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </form>
              
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.bmp,.tiff,.webp,application/pdf,text/plain,image/*"
              />
              
              <p className="text-xs text-muted-foreground text-center mt-2">
                WindexsAI может допускать ошибки. Проверяйте важную информацию.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
