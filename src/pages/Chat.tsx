import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, Square, Paperclip } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatMessage from "@/components/ChatMessage";
import ChatHeader from "@/components/ChatHeader";
import { ChatSidebar } from "@/components/ChatSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendChatMessage, type PlanStep } from "@/lib/openai";
import { apiClient, type Message } from "@/lib/api";
import { FileProcessor } from "@/lib/fileProcessor";
import { useAuth } from "@/contexts/AuthContext";

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
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialMessageSentRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Инициализация сессии и загрузка сообщений
  useEffect(() => {
    const initializeSession = async () => {
      if (!currentSessionId) {
        try {
          // Создаем новую сессию чата
          const { sessionId } = await apiClient.createSession("Новый чат");
          setCurrentSessionId(sessionId);

          // Загружаем сообщения сессии (если есть)
          const savedMessages = await apiClient.getMessages(sessionId);
          if (savedMessages.length > 0) {
            setMessages(savedMessages);
          } else {
            // Если нет сохраненных сообщений, проверяем initialMessage из контекста или location.state
            const initialMessage = initialChatMessage || location.state?.initialMessage;
            if (initialMessage && !initialMessageSentRef.current) {
              initialMessageSentRef.current = true;
              // Очищаем initialChatMessage после использования
              setInitialChatMessage(null);
              // Небольшая задержка для обеспечения корректной инициализации
              setTimeout(() => {
                sendMessage(initialMessage);
              }, 100);
            }
          }
        } catch (error) {
          console.error('Error initializing session:', error);
        }
      }
    };

    initializeSession();
  }, [currentSessionId]);

  // Также проверяем initialMessage при изменении initialChatMessage или location.state
  useEffect(() => {
    const initialMessage = initialChatMessage || location.state?.initialMessage;
    if (initialMessage && messages.length === 0 && currentSessionId && !initialMessageSentRef.current) {
      initialMessageSentRef.current = true;
      // Очищаем initialChatMessage после использования
      if (initialChatMessage) {
        setInitialChatMessage(null);
      }
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatMessage, location.state?.initialMessage, messages.length, currentSessionId]);

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

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || !currentSessionId) return;

    const userMessage: Message = { role: "user", content: messageText };
    const systemMessage: Message = {
      role: "system",
      content: "Ты полезный AI-ассистент. Каждый чат является полностью независимым и изолированным. Не используй информацию или контекст из других разговоров. Отвечай только на основе предоставленных сообщений в текущем чате."
    };
    const allMessages = [systemMessage, ...messages, userMessage];

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
    await apiClient.saveMessage(currentSessionId, "user", messageText);

    try {
      let assistantContent = "";
      let hasStartedAssistantMessage = false;

      await sendChatMessage(
        allMessages,
        selectedModel,
        (chunk: string) => {
          assistantContent += chunk;

          if (!hasStartedAssistantMessage) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: assistantContent },
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
        },
        // Колбэк для начала выполнения этапа
        (stepIndex: number, step: PlanStep) => {
          setCurrentStep(stepIndex);
          setIsPlanning(false);
        }
      );

      // Сохраняем ответ ассистента в базу данных
      if (assistantContent) {
        await apiClient.saveMessage(currentSessionId, "assistant", assistantContent);

        // Если это первый ответ ассистента, генерируем заголовок чата
        if (messages.length === 1 && currentSessionId) { // messages.length === 1 означает, что до этого было только сообщение пользователя
          await generateChatTitle(messageText, currentSessionId);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = "Извините, произошла ошибка. Пожалуйста, попробуйте снова.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);

      // Сохраняем сообщение об ошибке в базу данных
      await apiClient.saveMessage(currentSessionId, "assistant", errorMessage);

      // Сбрасываем состояние плана при ошибке
      setResponsePlan([]);
      setCurrentStep(-1);
      setIsPlanning(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
    if (typeof window !== 'undefined' && (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
    if (isLoading) return; // Предотвращаем одновременные операции

    try {
      // Очищаем все состояние перед созданием нового чата
      setMessages([]);
      setResponsePlan([]);
      setCurrentStep(-1);
      setIsPlanning(false);
      // НЕ очищаем initialMessageSentRef.current - это глобальный флаг за сессию

      // Создаем новую сессию
      const { sessionId: newSessionId } = await apiClient.createSession("Новый чат");
      setCurrentSessionId(newSessionId);

      // Обновляем sidebar для отображения новой сессии
      setSidebarRefreshTrigger(prev => prev + 1);
      // Очищаем input поле
      setInput("");
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

      setCurrentSessionId(sessionId);
      // Загружаем сообщения выбранного чата
      const chatMessages = await apiClient.getMessages(sessionId);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const generateChatTitle = async (userMessage: string, sessionId: number) => {
    try {
      // Генерируем заголовок на основе первого сообщения пользователя
      let title = userMessage.trim();

      // Ограничиваем длину заголовка
      if (title.length > 50) {
        title = title.substring(0, 47) + "...";
      }

      // Если сообщение слишком короткое, используем общий заголовок
      if (title.length < 5) {
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
      <div className="flex min-h-screen w-full bg-background">
        <ChatSidebar
          onSelectChat={handleSelectChat}
          currentSessionId={currentSessionId}
          refreshTrigger={sidebarRefreshTrigger}
          onChatDeleted={() => setSidebarRefreshTrigger(prev => prev + 1)}
        />

        <div className="flex flex-col flex-1 h-screen">
          <ChatHeader onNewChat={handleNewChat} />
      
          <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
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
            <ChatMessage key={index} message={message} />
          ))}

          {/* План выполнения ответа */}
          {(responsePlan.length > 0 || isPlanning) && (
            <div className="mb-6 p-4 bg-secondary/50 rounded-lg border border-secondary animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">📋</span>
                </div>
                <h3 className="font-semibold text-foreground">
                  {isPlanning ? "Создание плана ответа..." : "План выполнения"}
                </h3>
              </div>

              {isPlanning ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                  <span className="text-sm">Анализирую ваш вопрос и составляю план...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {responsePlan.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-2 rounded ${
                        index === currentStep
                          ? 'bg-primary/10 border border-primary/20'
                          : step.completed
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-muted/30'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
                        index === currentStep
                          ? 'bg-primary text-primary-foreground animate-pulse'
                          : step.completed
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.completed ? '✓' : index === currentStep ? '⏳' : index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-foreground">
                          {step.step}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {step.description}
                        </div>
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

          <div className="border-t border-border bg-background">
            <div className="max-w-3xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
              <div className="flex items-center gap-2 mb-3 overflow-x-auto">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[140px] sm:w-[200px] text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lite">WindexsAI Lite</SelectItem>
                    <SelectItem value="pro">WindexsAI Pro</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
                  {selectedModel === "pro" ? "Максимальная производительность" : "Быстрые ответы"}
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
                  className="h-10 w-10 sm:h-[52px] sm:w-[52px] shrink-0"
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
                  className={`${input.trim() ? "" : isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : ""}`}
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
