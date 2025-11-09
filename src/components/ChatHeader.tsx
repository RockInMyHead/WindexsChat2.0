import { Button } from "@/components/ui/button";
import { Plus, Globe, Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ChatHeaderProps {
  onNewChat: () => void;
  onCreateWebsite?: () => void;
}

const ChatHeader = ({ onNewChat, onCreateWebsite }: ChatHeaderProps) => {
  return (
    <header className="border-b border-border bg-background sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="lg:hidden" />
          <h1 className="text-lg md:text-xl font-semibold text-foreground">WindecsAI</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateWebsite}
            className="gap-2 hidden md:flex"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden lg:inline">Создать сайт</span>
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
