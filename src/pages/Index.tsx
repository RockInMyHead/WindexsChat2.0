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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/20 px-4">
      <div className="w-full max-w-3xl animate-fade-in">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            WindecsAI
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80">
            Я помогу вам <AnimatedText />
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full animate-slide-up">
          <div className="relative bg-card rounded-2xl shadow-lg border border-border p-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Отправьте сообщение WindecsAI..."
              className="min-h-[120px] resize-none border-0 focus-visible:ring-0 text-base"
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
                className="rounded-full h-10 w-10"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center mt-4">
            WindecsAI может допускать ошибки. Проверяйте важную информацию.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Index;
