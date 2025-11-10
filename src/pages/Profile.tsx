import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, User, Mail, Key, Crown, CreditCard, Calendar, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Состояние для модальных окон
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Состояние профиля пользователя
  const [userProfile, setUserProfile] = useState({
    name: "",
    email: ""
  });

  // Загружаем данные пользователя при монтировании компонента
  useEffect(() => {
    if (user) {
      setUserProfile({
        name: user.name,
        email: user.email
      });
    }
  }, [user]);

  // Данные подписки
  const currentPlan = {
    name: "WindexsAI Pro",
    status: "Активна",
    description: "Полный доступ ко всем функциям и моделям",
    price: "₽999/месяц",
    nextBilling: "15 декабря 2025"
  };

  // История платежей (демо данные)
  const paymentHistory = [
    {
      id: 1,
      date: "15 ноября 2025",
      amount: "₽999",
      status: "Оплачено",
      method: "Карта **** 4242"
    },
    {
      id: 2,
      date: "15 октября 2025",
      amount: "₽999",
      status: "Оплачено",
      method: "Карта **** 4242"
    },
    {
      id: 3,
      date: "15 сентября 2025",
      amount: "₽999",
      status: "Оплачено",
      method: "Карта **** 4242"
    }
  ];

  // Обработчики кнопок
  const handleSaveProfile = () => {
    alert("Профиль сохранен успешно!");
    // Здесь можно добавить логику сохранения в базу данных или API
  };

  const handleChangePlan = () => {
    setShowPlanModal(true);
  };

  const handleViewPayments = () => {
    setShowPaymentModal(true);
  };

  const handleChangePassword = () => {
    alert("Функция изменения пароля будет доступна в ближайшее время");
  };

  const handleDeleteAccount = () => {
    if (confirm("Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.")) {
      alert("Аккаунт будет удален. Функция будет реализована в ближайшее время.");
    }
  };

  const handlePlanChange = (newPlan: string) => {
    alert(`План изменен на: ${newPlan}. Функция будет реализована в ближайшее время.`);
    setShowPlanModal(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chat")}
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-semibold text-foreground">Личный кабинет</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
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
              <Input
                id="name"
                placeholder="Ваше имя"
                value={userProfile.name}
                onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Mail className="h-4 w-4 mt-3 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={userProfile.email}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleSaveProfile}
            >
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
            <CardDescription>Управление подпиской WindexsAI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">{currentPlan.name}</h3>
                <span className="text-sm text-green-600 font-medium">{currentPlan.status}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {currentPlan.description}
              </p>
              <div className="text-xs text-muted-foreground mb-4">
                {currentPlan.price} • Следующий платеж: {currentPlan.nextBilling}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChangePlan}
                >
                  Изменить план
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewPayments}
                >
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
            <Button
              variant="outline"
              onClick={handleChangePassword}
            >
              Изменить пароль
            </Button>
            <div className="pt-4 border-t border-border">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
              >
                Удалить аккаунт
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Модальное окно изменения плана */}
        <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Изменить план подписки
              </DialogTitle>
              <DialogDescription>
                Выберите подходящий тарифный план для ваших нужд
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Текущий план */}
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-foreground">{currentPlan.name}</h4>
                  <span className="text-sm bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    Текущий
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlan.description}
                </p>
                <p className="text-sm font-medium text-primary mt-1">
                  {currentPlan.price}
                </p>
              </div>

              {/* Доступные планы */}
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Доступные планы:</h4>

                <div className="p-4 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-semibold">WindexsAI Lite</h5>
                    <span className="text-sm text-muted-foreground">₽499/месяц</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Базовые функции и модель GPT-3.5
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handlePlanChange("WindexsAI Lite")}
                  >
                    Выбрать
                  </Button>
                </div>

                <div className="p-4 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-semibold">WindexsAI Pro</h5>
                    <span className="text-sm text-muted-foreground">₽999/месяц</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Полный доступ ко всем функциям и моделям GPT-4
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handlePlanChange("WindexsAI Pro")}
                    disabled={true}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Текущий план
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Модальное окно истории платежей */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                История платежей
              </DialogTitle>
              <DialogDescription>
                Список всех ваших платежей и транзакций
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {paymentHistory.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{payment.amount}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {payment.date}
                      </p>
                      <p className="text-xs text-muted-foreground">{payment.method}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-green-600">
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}

              {paymentHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>История платежей пуста</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Profile;
