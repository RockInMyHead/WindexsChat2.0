import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import AnimatedText from "@/components/AnimatedText";

const Index = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      navigate("/chat", { state: { initialMessage: input } });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/20 px-3 sm:px-4">
      <div className="w-full max-w-3xl animate-fade-in">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 sm:mb-6">
            WindecsAI
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-foreground/80 px-2">
            Я помогу вам <AnimatedText />
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full animate-slide-up">
          <div className="relative bg-card rounded-xl sm:rounded-2xl shadow-lg border border-border p-3 sm:p-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Отправьте сообщение WindecsAI..."
              className="min-h-[100px] sm:min-h-[120px] resize-none border-0 focus-visible:ring-0 text-sm sm:text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex justify-end mt-2">
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center mt-3 sm:mt-4 px-2">
            WindecsAI может допускать ошибки. Проверяйте важную информацию.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Index;
