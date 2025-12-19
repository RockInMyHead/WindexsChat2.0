import { Button } from "@/components/ui/button";
import { Plus, Wifi, WifiOff } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ChatHeaderProps {
  onNewChat: () => void;
  internetEnabled: boolean;
  onToggleInternet: () => void;
}

const ChatHeader = ({ onNewChat, internetEnabled, onToggleInternet }: ChatHeaderProps) => {
  return (
    <header className="border-b border-border bg-background sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="lg:hidden" />
          {/* Заголовок WindexsAI убран по запросу пользователя */}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={internetEnabled ? "default" : "outline"}
            size="sm"
            onClick={onToggleInternet}
            className={`gap-2 ${internetEnabled ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
            title={internetEnabled ? "Интернет-поиск включен" : "Интернет-поиск отключен"}
          >
            {internetEnabled ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
          </Button>
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
