import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Mail, Key, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chat")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Личный кабинет</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <User className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-foreground">Профиль пользователя</CardTitle>
                <CardDescription>Управление вашим аккаунтом</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input id="name" placeholder="Ваше имя" defaultValue="Пользователь" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Mail className="h-4 w-4 mt-3 text-muted-foreground" />
                <Input id="email" type="email" placeholder="email@example.com" />
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90">
              Сохранить изменения
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Подписка
            </CardTitle>
            <CardDescription>Управление подпиской WindecsAI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">WindecsAI Pro</h3>
                <span className="text-sm text-muted-foreground">Активна</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Полный доступ ко всем функциям и моделям
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Изменить план
                </Button>
                <Button variant="outline" size="sm">
                  История платежей
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Key className="h-5 w-5" />
              Безопасность
            </CardTitle>
            <CardDescription>Настройки безопасности аккаунта</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline">
              Изменить пароль
            </Button>
            <div className="pt-4 border-t border-border">
              <Button variant="destructive">
                Удалить аккаунт
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
