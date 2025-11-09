import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, Paperclip, Globe } from "lucide-react";
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

interface Message {
  role: "user" | "assistant";
  content: string;
}

const Chat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("lite");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initialMessage = location.state?.initialMessage;
    if (initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let hasStartedAssistantMessage = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                assistantContent += content;
                
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
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Извините, произошла ошибка. Пожалуйста, попробуйте снова.",
        },
      ]);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Здесь будет логика загрузки файла
      console.log("File selected:", file.name);
    }
  };

  const handleVoiceRecord = () => {
    // Здесь будет логика записи аудио
    console.log("Voice recording started");
  };

  const handleCreateWebsite = () => {
    setInput("Помоги мне создать веб-сайт. Какой сайт ты хочешь создать?");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <ChatSidebar onNewChat={() => navigate("/")} />
        
        <div className="flex flex-col flex-1 h-screen">
          <ChatHeader 
            onNewChat={() => navigate("/")} 
            onCreateWebsite={handleCreateWebsite}
          />
      
          <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
          {messages.length === 0 && (
            <div className="text-center py-12 sm:py-20 animate-fade-in">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">
                WindecsAI
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                Начните диалог, отправив сообщение
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateWebsite}
                  className="gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Создать сайт
                </Button>
              </div>
            </div>
          )}
          
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          
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
                    <SelectItem value="lite">WindecsAI Lite</SelectItem>
                    <SelectItem value="pro">WindecsAI Pro</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
                  {selectedModel === "pro" ? "Максимальная производительность" : "Быстрые ответы"}
                </span>
              </div>
              
              <form onSubmit={handleSubmit} className="flex gap-1 sm:gap-2">
                <div className="flex gap-1 sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 sm:h-[52px] sm:w-[52px] shrink-0"
                    onClick={handleFileUpload}
                    disabled={isLoading}
                  >
                    <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 sm:h-[52px] sm:w-[52px] shrink-0"
                    onClick={handleVoiceRecord}
                    disabled={isLoading}
                  >
                    <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </div>
                
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
                  type="submit"
                  size="icon"
                  className="h-10 w-10 sm:h-[52px] sm:w-[52px] shrink-0"
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </form>
              
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="*/*"
              />
              
              <p className="text-xs text-muted-foreground text-center mt-2">
                WindecsAI может допускать ошибки. Проверяйте важную информацию.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
