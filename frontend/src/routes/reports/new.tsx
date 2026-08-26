import { useState, useMemo, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Send, Save, Lightbulb, ClipboardList } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useAuthGuard } from "@/lib/auth";
import {
  monthlyReportTemplate, reports, groups,
  freshReportId, persistReports,
  countAthletesUnder21, calculateWeeklyHours, getPlanItemsForMonth,
  getMonthNameFromDate, type PlanItem,
} from "@/lib/mock-data";

export const Route = createFileRoute("/reports/new")({
  head: () => ({
    meta: [
      { title: "Новый отчёт — СОКОЛ" },
      { name: "description", content: "Создание ежемесячного отчёта тренера." },
    ],
  }),
  component: NewReportPage,
});

const now = new Date();
const defaultStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "dd.MM.yyyy");
const defaultEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "dd.MM.yyyy");

function formatPlanItemShort(item: PlanItem): string {
  const parts: string[] = [];
  if (item.date) parts.push(item.date);
  parts.push(item.name);
  if (item.location) parts.push(`(${item.location})`);
  if (item.participantsCount) parts.push(`— ${item.participantsCount} уч.`);
  return parts.join(" ");
}

function NewReportPage() {
  const { loading } = useAuthGuard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const template = monthlyReportTemplate;

  const coachGroups = useMemo(() => {
    if (!user?.id) return [];
    return groups.filter((gr) => gr.coachId === user.id);
  }, [user]);

  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [form, setForm] = useState<Record<string, string>>({
    athletes_count: "",
    hours_per_week: "",
    special_events: "",
    sport_events: "",
    development_events: "",
  });

  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});

  // ── Plan hints ──────────────────────────────────────────────────────────
  const monthName = useMemo(() => getMonthNameFromDate(periodStart), [periodStart]);

  const planItems = useMemo(() => {
    if (!user?.id || !monthName) return null;
    return getPlanItemsForMonth(user.id, monthName);
  }, [user, monthName]);

  // ── Auto-fill #1: athletes count (≤21) ─────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const count = countAthletesUnder21(user.id);
    setForm((prev) => ({ ...prev, athletes_count: String(count) }));
    setAutoFilled((prev) => ({ ...prev, athletes_count: true }));
  }, [user]);

  // ── Auto-fill #2: weekly hours from schedule ────────────────────────────
  const recalcHours = useCallback(() => {
    if (!user?.id) return;
    const hrs = calculateWeeklyHours(user.id, periodStart, periodEnd);
    setForm((prev) => ({ ...prev, hours_per_week: String(hrs) }));
    setAutoFilled((prev) => ({ ...prev, hours_per_week: true }));
  }, [user, periodStart, periodEnd]);

  useEffect(() => {
    recalcHours();
  }, [recalcHours]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setAutoFilled((prev) => ({ ...prev, [key]: false }));
  };

  const fillFromPlan = (fieldKey: string, items: PlanItem[]) => {
    if (items.length === 0) return;
    const text = items
      .map((item, i) => `${i + 1}. ${formatPlanItemShort(item)}`)
      .join("\n");
    setForm((prev) => ({ ...prev, [fieldKey]: text }));
    setAutoFilled((prev) => ({ ...prev, [fieldKey]: false }));
  };

  const save = (status: "draft" | "submitted") => {
    const id = freshReportId();
    const r = {
      id,
      templateId: template.id,
      coachId: user?.id ?? "",
      coachName: user?.coachName ?? "",
      coachInitials: (user?.coachName ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2),
      sport: user?.coachDiscipline ?? "",
      group: coachGroups.map((g) => g.name).join(", "),
      centerId: user?.centerId ?? "center-1",
      periodStart,
      periodEnd,
      data: { ...form, athletes_count: Number(form.athletes_count), hours_per_week: Number(form.hours_per_week) },
      status,
      createdAt: format(new Date(), "dd.MM.yyyy"),
      submittedAt: status === "submitted" ? format(new Date(), "dd.MM.yyyy") : undefined,
    };
    reports.push(r);
    persistReports();
    navigate({ to: "/reports" });
  };

  const isValid = form.athletes_count.trim() !== "" && form.hours_per_week.trim() !== "";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const planHintMap: Record<string, PlanItem[] | undefined> = {
    special_events: planItems?.category3,
    sport_events: planItems?.category4,
    development_events: planItems?.category5,
  };

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
          <Button variant="outline" onClick={() => save("draft")} disabled={!isValid}>
            <Save className="mr-1.5 h-4 w-4" /> Сохранить черновик
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => save("submitted")}
            disabled={!isValid}
          >
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
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  placeholder="ДД.ММ.ГГГГ"
                  className="h-9 w-32"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
              <Input className="h-9" value={user?.coachDiscipline ?? ""} readOnly />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {coachGroups.length > 0 ? (
                  coachGroups.map((g) => (
                    <Badge key={g.id} variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                      {g.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Нет групп</span>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО тренера</label>
              <Input className="h-9" value={user?.coachName ?? ""} readOnly />
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {template.fields.map((field) => {
            const planItemsForField = planHintMap[field.key];
            const hasPlanItems = planItemsForField && planItemsForField.length > 0;

            return (
              <div key={field.key}>
                <label className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-secondary">
                  <span className="h-5 w-5 flex-shrink-0 rounded-full bg-primary/10 text-center text-[10px] leading-5 text-primary">
                    {template.fields.indexOf(field) + 1}
                  </span>
                  {field.label}
                  {autoFilled[field.key] && (
                    <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      авто
                    </span>
                  )}
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
                  <>
                    {hasPlanItems && (
                      <div className="mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Lightbulb className="h-3.5 w-3.5" />
                          Запланировано на {monthName}:
                        </div>
                        <ul className="mb-2 space-y-1 text-xs text-muted-foreground">
                          {planItemsForField!.map((item) => (
                            <li key={item.id} className="flex items-start gap-1.5">
                              <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary/40" />
                              {formatPlanItemShort(item)}
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-primary hover:text-primary/80"
                          onClick={() => fillFromPlan(field.key, planItemsForField!)}
                        >
                          <ClipboardList className="h-3 w-3" />
                          Заполнить из плана
                        </Button>
                      </div>
                    )}
                    <textarea
                      value={form[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={
                        hasPlanItems
                          ? "Нажмите «Заполнить из плана» или введите вручную..."
                          : "Опишите проведённые мероприятия (с указанием дат, места, количества участников)..."
                      }
                      className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      rows={5}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Тренер-преподаватель:</span> _______________ / {user?.coachName ?? "_______________"}
          </p>
          <p className="mt-4 text-xs text-muted-foreground/60">
            * — поля, обязательные для заполнения. После отправки отчёт будет проверен руководителем центра.
          </p>
        </div>
      </Card>
    </AppShell>
  );
}
