interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-4 mb-6 animate-fade-in ${isUser ? "" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold shrink-0 ${
        isUser 
          ? "bg-secondary text-secondary-foreground" 
          : "bg-primary text-primary-foreground"
      }`}>
        {isUser ? "Вы" : "AI"}
      </div>
      <div className="flex-1 pt-1">
        <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
