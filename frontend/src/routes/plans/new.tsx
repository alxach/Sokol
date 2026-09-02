import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send, Save, Plus, Trash2, CalendarDays, AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CategoryReference } from "@/components/category-reference";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { planCategories, planCategoryKeys, type PlanCategoryId } from "@/lib/plan-categories";
import { Plan, type PlanItem, type PlanStatus } from "@/lib/api/plans.functions";
import { monthOptions, monthToQuarter, monthNumber, ensurePlan, addPlanItem, updatePlanItem, submitPlanItem, deletePlanItem } from "@/lib/api/plans.functions";
import { statusConfig } from "@/routes/plans";

export const Route = createFileRoute("/plans/new")({
  head: () => ({
    meta: [
      { title: "Новый план — СОКОЛ" },
      { name: "description", content: "Создание плана мероприятий тренера на год." },
    ],
  }),
  component: NewPlanPage,
});

const yearOptions = [2025, 2026, 2027];

const quarterOptions = [1, 2, 3, 4];

interface PlanItemForm {
  categoryId: PlanCategoryId;
  quarter: number;
  month: string;
  date: string;
  name: string;
  description: string;
  location: string;
  participantsCategory: string;
  participantsCount: string;
}

interface DraftItem {
  key: string;
  id: string | null;
  status: PlanStatus | null;
  data: PlanItemForm;
}

let itemKeyCounter = 0;
function freshItemKey() {
  return `item_${++itemKeyCounter}`;
}

function toDraftItems(plan: Plan): DraftItem[] {
  return plan.items.map((i) => ({
    key: freshItemKey(),
    id: i.id,
    status: i.status,
    data: {
      categoryId: i.categoryId,
      quarter: i.quarter,
      month: i.month,
      date: i.date,
      name: i.name,
      description: i.description,
      location: i.location,
      participantsCategory: i.participantsCategory,
      participantsCount: i.participantsCount,
    },
  }));
}

function initialItem(quarter: number, month: string): DraftItem {
  return {
    key: freshItemKey(),
    id: null,
    status: null,
    data: {
      categoryId: "3",
      quarter,
      month,
      date: "",
      name: "",
      description: "",
      location: "",
      participantsCategory: "",
      participantsCount: "",
    },
  };
}

function NewPlanPage() {
  const { loading } = useAuthGuard();
  const { isCoach } = useAuth();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const [year, setYear] = useState(currentYear);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);

  const loadPlan = useCallback(
    async (targetYear: number) => {
      setPlansLoading(true);
      try {
        const p = await ensurePlan(targetYear);
        setPlan(p);
        setItems(toDraftItems(p));
      } catch (e) {
        alert(e instanceof Error ? e.message : "Не удалось открыть план");
        navigate({ to: "/plans" });
      } finally {
        setPlansLoading(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!loading) void loadPlan(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const changeYear = (y: number) => {
    setYear(y);
    void loadPlan(y);
  };

  const coachName = plan?.coachName ?? "";
  const discipline = plan?.discipline ?? "";

  const categoryCounts = useMemo(
    () =>
      planCategoryKeys.map((catId) => ({
        id: catId,
        label: planCategories[catId].shortLabel,
        count: items.filter((i) => i.data.categoryId === catId).length,
      })),
    [items],
  );

  const updateItem = (key: string, field: keyof PlanItemForm, value: string | number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.key === key ? { ...it, data: { ...it.data, [field]: value } } : it,
      ),
    );
  };

  const removeItem = async (it: DraftItem) => {
    if (it.id) {
      try {
        await deletePlanItem(it.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Не удалось удалить мероприятие");
        return;
      }
    }
    setItems((prev) => prev.filter((x) => x.key !== it.key));
  };

  const invalid = items.filter((it) => !it.data.name.trim() || !it.data.date.trim());
  const anyEditableDraft = items.some((it) => !it.id || it.status === "draft");

  const persistAll = async (): Promise<boolean> => {
    if (!plan) return false;
    if (invalid.length > 0) {
      alert(`Заполните наименование и дату для всех мероприятий (пропущено: ${invalid.length}).`);
      return false;
    }
    try {
      for (const it of items) {
        const payload = {
          category: it.data.categoryId,
          quarter: it.data.quarter,
          month: monthNumber(it.data.month),
          date: it.data.date,
          name: it.data.name,
          description: it.data.description || undefined,
          location: it.data.location || undefined,
          participantsCategory: it.data.participantsCategory || undefined,
          participantsCount: it.data.participantsCount || undefined,
        };
        if (it.id && it.status === "draft") {
          await updatePlanItem(it.id, payload);
        } else if (!it.id) {
          await addPlanItem(plan.id, payload);
        }
      }
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить план");
      return false;
    }
  };

  const saveDraft = async () => {
    if (!(await persistAll())) return;
    navigate({ to: "/plans" });
  };

  const saveAndSubmit = async () => {
    if (!(await persistAll())) return;
    try {
      const p = await ensurePlan(year);
      for (const it of p.items.filter((i) => i.status === "draft")) {
        await submitPlanItem(it.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось отправить на проверку");
      return;
    }
    navigate({ to: "/plans" });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!isCoach) {
    return (
      <AppShell title="Новый план мероприятий" subtitle="Создание плана тренера на год">
        <Card className="mx-auto mt-16 max-w-lg p-8 text-center shadow-[var(--shadow-card)]">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Создавать план мероприятий может только тренер.
          </p>
        </Card>
      </AppShell>
    );
  }

  if (plansLoading || !plan) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const yearLabel = `${year} год`;

  return (
    <AppShell title="Новый план мероприятий" subtitle={`План тренера на ${yearLabel}`}>
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
            {coachName} · {discipline} · {yearLabel}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={!anyEditableDraft} onClick={saveDraft}>
            <Save className="mr-1.5 h-4 w-4" /> Сохранить черновик
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!anyEditableDraft} onClick={saveAndSubmit}>
            <Send className="mr-1.5 h-4 w-4" /> Отправить на проверку
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Год</label>
          <div className="flex gap-1.5">
            {yearOptions.map((y) => (
              <button
                key={y}
                onClick={() => changeYear(y)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  year === y
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {y}
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

      <div className="mb-4 flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() =>
            setItems((prev) => [
              ...prev,
              initialItem(currentQuarter, monthOptions[currentQuarter * 3 - 3]),
            ])
          }
          className="border-dashed"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Добавить мероприятие
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const editable = item.status === null || item.status === "draft";
          return (
            <Card key={item.key} className="border border-border p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Мероприятие #{index + 1}
                  {item.status && (
                    <Badge variant="outline" className={`ml-2 font-normal ${statusConfig[item.status].style}`}>
                      {statusConfig[item.status].label}
                    </Badge>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!editable}
                  onClick={() => removeItem(item)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория *</label>
                  <select
                    value={item.data.categoryId}
                    disabled={!editable}
                    onChange={(e) => updateItem(item.key, "categoryId", e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  >
                    {planCategoryKeys.map((catId) => (
                      <option key={catId} value={catId}>
                        {catId}. {planCategories[catId].shortLabel}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5">
                    <CategoryReference categoryId={item.data.categoryId} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Квартал *</label>
                  <select
                    value={item.data.quarter}
                    disabled={!editable}
                    onChange={(e) => {
                      const newQuarter = Number(e.target.value);
                      const monthsInQuarter = monthOptions.filter((m) => monthToQuarter[m] === newQuarter);
                      const currentMonthInQuarter = monthsInQuarter.includes(item.data.month);
                      updateItem(item.key, "quarter", newQuarter);
                      if (!currentMonthInQuarter) {
                        updateItem(item.key, "month", monthsInQuarter[0]);
                      }
                    }}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  >
                    {quarterOptions.map((q) => (
                      <option key={q} value={q}>{q} кв.</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Месяц *</label>
                  <select
                    value={item.data.month}
                    disabled={!editable}
                    onChange={(e) => updateItem(item.key, "month", e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  >
                    {monthOptions.filter((m) => monthToQuarter[m] === item.data.quarter).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата *</label>
                  <Input
                    value={item.data.date}
                    disabled={!editable}
                    onChange={(e) => updateItem(item.key, "date", e.target.value)}
                    placeholder="ДД.ММ.ГГГГ"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Место проведения</label>
                  <Input
                    value={item.data.location}
                    disabled={!editable}
                    onChange={(e) => updateItem(item.key, "location", e.target.value)}
                    placeholder="ЦСЕ, школа…"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Наименование мероприятия *</label>
                <Input
                  value={item.data.name}
                  disabled={!editable}
                  onChange={(e) => updateItem(item.key, "name", e.target.value)}
                  placeholder="Название мероприятия"
                  className="h-9"
                />
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Формат / содержание / цель</label>
                <textarea
                  value={item.data.description}
                  disabled={!editable}
                  onChange={(e) => updateItem(item.key, "description", e.target.value)}
                  placeholder="Опишите формат, содержание и цель мероприятия…"
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  rows={3}
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория участников</label>
                  <Input
                    value={item.data.participantsCategory}
                    disabled={!editable}
                    onChange={(e) => updateItem(item.key, "participantsCategory", e.target.value)}
                    placeholder="Спортсмены ЦСЕ, школьники…"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Количество участников</label>
                  <Input
                    value={item.data.participantsCount}
                    disabled={!editable}
                    onChange={(e) => updateItem(item.key, "participantsCount", e.target.value)}
                    placeholder="20"
                    className="h-9"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <p className="mt-2 text-xs text-muted-foreground/60">
          * — поля, обязательные для заполнения. После отправки план будет проверен руководителем центра.
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/60">
          <CalendarDays className="h-3 w-3" /> Мероприятия сохраняются в черновик автоматически при отправке.
        </p>
      </div>
    </AppShell>
  );
}

export default NewPlanPage;