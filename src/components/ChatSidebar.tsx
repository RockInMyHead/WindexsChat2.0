import { MessageSquare, User, Plus, Menu } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Chat {
  id: string;
  title: string;
  timestamp: string;
}

interface ChatSidebarProps {
  onNewChat: () => void;
}

export function ChatSidebar({ onNewChat }: ChatSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [chats] = useState<Chat[]>([
    { id: "1", title: "Составление отчета о продажах", timestamp: "Сегодня" },
    { id: "2", title: "Написание поста для соцсетей", timestamp: "Вчера" },
    { id: "3", title: "Визуализация данных аналитики", timestamp: "2 дня назад" },
  ]);

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon" side="left">
      <SidebarContent className="bg-background border-r border-border">
        <div className="p-4 flex items-center justify-between">
          {!collapsed && (
            <h2 className="text-lg font-semibold text-foreground">WindecsAI</h2>
          )}
          <SidebarTrigger className="ml-auto" />
        </div>

        <div className="px-2 mb-4">
          <Button
            onClick={onNewChat}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
            size={collapsed ? "icon" : "default"}
          >
            <Plus className="h-4 w-4" />
            {!collapsed && <span>Новый чат</span>}
          </Button>
        </div>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-muted-foreground px-4">
              История чатов
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/chat/${chat.id}`}
                      className="hover:bg-muted/50 flex items-center gap-2"
                      activeClassName="bg-muted text-primary"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm truncate">{chat.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {chat.timestamp}
                          </p>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-2 border-t border-border">
          <SidebarMenuButton asChild>
            <NavLink
              to="/profile"
              className="hover:bg-muted/50 flex items-center gap-2 w-full"
              activeClassName="bg-muted text-primary"
            >
              <User className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Личный кабинет</span>}
            </NavLink>
          </SidebarMenuButton>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
