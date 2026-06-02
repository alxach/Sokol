import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthGuard } from "@/lib/auth";
import { monthlyReportTemplate } from "@/lib/mock-data";

export const Route = createFileRoute("/reports/new")({
  head: () => ({
    meta: [
      { title: "Новый отчёт — СОКОЛ" },
      { name: "description", content: "Создание ежемесячного отчёта тренера." },
    ],
  }),
  component: NewReportPage,
});

function NewReportPage() {
  const { loading } = useAuthGuard();
  const navigate = useNavigate();
  const template = monthlyReportTemplate;

  const [form, setForm] = useState<Record<string, string>>({
    athletes_count: "",
    hours_per_week: "",
    special_events: "",
    sport_events: "",
    development_events: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell
      title="Новый отчёт"
      subtitle="Ежемесячный отчёт тренера-преподавателя ЦСЕ"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate({ to: "/reports" })}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> К списку отчётов
          </button>
          <h2 className="font-display text-2xl font-bold text-secondary">
            {template.name}
          </h2>
          <p className="text-sm text-muted-foreground">{template.description}</p>
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

      <Card className="shadow-[var(--shadow-card)]">
        <div className="border-b border-border p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Отчётный период *</label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="ДД.ММ.ГГГГ"
                  className="h-9 w-32"
                  defaultValue="01.06.2026"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  placeholder="ДД.ММ.ГГГГ"
                  className="h-9 w-32"
                  defaultValue="30.06.2026"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
              <Input className="h-9" defaultValue="Дзюдо" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа</label>
              <Input className="h-9" defaultValue="Начальная подготовка" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО тренера</label>
              <Input className="h-9" defaultValue="Аксючиц Елена Николаевна" />
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {template.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-secondary">
                <span className="h-5 w-5 flex-shrink-0 rounded-full bg-primary/10 text-center text-[10px] leading-5 text-primary">
                  {template.fields.indexOf(field) + 1}
                </span>
                {field.label}
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                Норма: <span className="font-medium text-foreground">{field.norm}</span>
              </p>

              {field.type === "number" ? (
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="h-10 w-32"
                />
              ) : (
                <textarea
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder="Опишите проведённые мероприятия (с указанием дат, места, количества участников)..."
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={5}
                />
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border p-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Тренер-преподаватель:</span> _______________ / _______________
          </p>
          <p className="mt-4 text-xs text-muted-foreground/60">
            * — поля, обязательные для заполнения. После отправки отчёт будет проверен руководителем центра.
          </p>
        </div>
      </Card>
    </AppShell>
  );
}
