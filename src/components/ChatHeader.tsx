import { Button } from "@/components/ui/button";
import { Plus, Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ChatHeaderProps {
  onNewChat: () => void;
}

const ChatHeader = ({ onNewChat }: ChatHeaderProps) => {
  return (
    <header className="border-b border-border bg-background sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="lg:hidden" />
          {/* Заголовок WindexsAI убран по запросу пользователя */}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onNewChat}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Новый чат</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
