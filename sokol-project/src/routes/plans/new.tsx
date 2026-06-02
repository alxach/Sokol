import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send, Save, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { planCategories, planCategoryKeys, type PlanCategoryId } from "@/lib/mock-data";

export const Route = createFileRoute("/plans/new")({
  head: () => ({
    meta: [
      { title: "Новый план — СОКОЛ" },
      { name: "description", content: "Создание плана мероприятий тренера на квартал." },
    ],
  }),
  component: NewPlanPage,
});

const monthOptions = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

interface PlanItemForm {
  key: string;
  categoryId: PlanCategoryId;
  month: string;
  date: string;
  name: string;
  description: string;
  location: string;
  participantsCategory: string;
  participantsCount: string;
}

let itemKeyCounter = 0;
function freshItemKey() {
  return `item_${++itemKeyCounter}`;
}

const initialItem = (): PlanItemForm => ({
  key: freshItemKey(),
  categoryId: "3",
  month: "Январь",
  date: "",
  name: "",
  description: "",
  location: "",
  participantsCategory: "",
  participantsCount: "",
});

function NewPlanPage() {
  const { loading } = useAuthGuard();
  const { user, isCoach } = useAuth();
  const navigate = useNavigate();

  const [quarter, setQuarter] = useState(2);
  const [year] = useState(2026);
  const [coachName] = useState(isCoach ? user?.coachName ?? "" : "Вебер Александр Викторович");
  const [discipline] = useState(isCoach ? user?.coachDiscipline ?? "Бокс" : "Бокс");
  const [items, setItems] = useState<PlanItemForm[]>([initialItem()]);

  const addItem = () => setItems((prev) => [...prev, initialItem()]);
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const updateItem = (key: string, field: keyof PlanItemForm, value: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const quarterLabel = `${quarter} квартал ${year}`;

  const categoryCounts = planCategoryKeys.map((catId) => ({
    id: catId,
    label: planCategories[catId].shortLabel,
    count: items.filter((i) => i.categoryId === catId).length,
  }));

  return (
    <AppShell title="Новый план мероприятий" subtitle={`План тренера на ${quarterLabel}`}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate({ to: "/plans" })}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> К списку планов
          </button>
          <h2 className="font-display text-2xl font-bold text-secondary">
            План мероприятий
          </h2>
          <p className="text-sm text-muted-foreground">
            {coachName} · {discipline} · {quarterLabel}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Save className="mr-1.5 h-4 w-4" /> Сохранить черновик
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Send className="mr-1.5 h-4 w-4" /> Отправить на проверку
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Квартал</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  quarter === q
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {q} кв.
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО тренера</label>
          <Input className="h-9 w-64" value={coachName} readOnly />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
          <Input className="h-9 w-32" value={discipline} readOnly />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {categoryCounts.map((c) => (
          <Badge key={c.id} variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
            {c.label}: {c.count}
          </Badge>
        ))}
        <Badge variant="outline" className="border-border font-normal text-muted-foreground">
          Всего: {items.length}
        </Badge>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={item.key} className="border border-border p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Мероприятие #{index + 1}
              </span>
              <Button variant="ghost" size="sm" onClick={() => removeItem(item.key)} className="text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория *</label>
                <select
                  value={item.categoryId}
                  onChange={(e) => updateItem(item.key, "categoryId", e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {planCategoryKeys.map((catId) => (
                    <option key={catId} value={catId}>
                      {catId}. {planCategories[catId].shortLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Месяц *</label>
                <select
                  value={item.month}
                  onChange={(e) => updateItem(item.key, "month", e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата *</label>
                <Input
                  value={item.date}
                  onChange={(e) => updateItem(item.key, "date", e.target.value)}
                  placeholder="ДД.ММ.ГГГГ"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Место проведения</label>
                <Input
                  value={item.location}
                  onChange={(e) => updateItem(item.key, "location", e.target.value)}
                  placeholder="ЦСЕ, школа…"
                  className="h-9"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Наименование мероприятия *</label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.key, "name", e.target.value)}
                placeholder="Название мероприятия"
                className="h-9"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Формат / содержание / цель</label>
              <textarea
                value={item.description}
                onChange={(e) => updateItem(item.key, "description", e.target.value)}
                placeholder="Опишите формат, содержание и цель мероприятия…"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                rows={3}
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория участников</label>
                <Input
                  value={item.participantsCategory}
                  onChange={(e) => updateItem(item.key, "participantsCategory", e.target.value)}
                  placeholder="Спортсмены ЦСЕ, школьники…"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Количество участников</label>
                <Input
                  value={item.participantsCount}
                  onChange={(e) => updateItem(item.key, "participantsCount", e.target.value)}
                  placeholder="20"
                  className="h-9"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" onClick={addItem} className="border-dashed">
          <Plus className="mr-1.5 h-4 w-4" /> Добавить мероприятие
        </Button>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Тренер-преподаватель:</span> _______________ / {coachName}
        </p>
        <p className="mt-2 text-xs text-muted-foreground/60">
          * — поля, обязательные для заполнения. После отправки план будет проверен руководителем центра.
        </p>
      </div>
    </AppShell>
  );
}
