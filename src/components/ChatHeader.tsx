import { Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

const ChatHeader = () => {
  return (
    <header className="border-b border-border bg-background sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="lg:hidden" />
          {/* Заголовок WindexsAI убран по запросу пользователя */}
        </div>
        <div className="flex items-center gap-2">
          {/* Кнопка "Новый чат" убрана по запросу пользователя */}
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
