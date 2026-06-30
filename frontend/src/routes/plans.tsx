import { useState, useMemo, useCallback } from "react";
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Search, CheckCircle, XCircle, Send, Eye, CalendarDays, LayoutList, Trash2, CalendarIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { useCenter } from "@/lib/center";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { plans, planCategories, planCategoryKeys, type Plan, type PlanItem, type PlanStatus, type PlanCategoryId } from "@/lib/mock-data";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Планы мероприятий — СОКОЛ" },
      { name: "description", content: "Планы мероприятий тренеров на год." },
    ],
  }),
  component: PlansPage,
});

const statusConfig: Record<PlanStatus, { label: string; style: string }> = {
  draft: { label: "Черновик", style: "bg-muted text-muted-foreground border-border" },
  submitted: { label: "На проверке", style: "bg-accent/15 text-accent-foreground border-accent/30" },
  approved: { label: "Утверждён", style: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" },
  rejected: { label: "Отклонён", style: "bg-destructive/10 text-destructive border-destructive/30" },
};

const statusFilters: ("Все" | PlanStatus)[] = ["Все", "draft", "submitted", "approved", "rejected"];

const quarterOptions = [1, 2, 3, 4];

const quarterLabel: Record<number, string> = {
  1: "I кв.", 2: "II кв.", 3: "III кв.", 4: "IV кв.",
};

const itemStatusCounts = (items: PlanItem[]) => {
  const counts = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
  for (const i of items) counts[i.status]++;
  return counts;
};

function planAggregateStatus(items: PlanItem[]): PlanStatus {
  const counts = itemStatusCounts(items);
  if (counts.submitted > 0) return "submitted";
  if (counts.rejected > 0) return "rejected";
  if (counts.approved > 0 && counts.draft === 0) return "approved";
  return "draft";
}

function hasItemsInQuarter(items: PlanItem[], quarter: number): boolean {
  return items.some((i) => i.quarter === quarter);
}

function PlansPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach, isDirector } = useAuth();
  const { selectedCenterId } = useCenter();
  const routerState = useRouterState();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");
  const [quarterFilter, setQuarterFilter] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const accessible = useMemo(() => {
    if (!user) return [];
    if (isCoach) return plans.filter((p) => p.coachId === user.id);
    if (isAdmin && user?.centerId) return plans.filter((p) => p.centerId === user.centerId);
    if (isDirector && selectedCenterId) return plans.filter((p) => p.centerId === selectedCenterId);
    return plans;
  }, [isCoach, isAdmin, isDirector, selectedCenterId, user]);

  const filtered = useMemo(() => {
    return accessible.filter((p) => {
      const q = query.trim().toLowerCase();
      const aggStatus = planAggregateStatus(p.items);
      const matchQ = !q || p.coachName.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.discipline.toLowerCase().includes(q);
      const matchS = statusFilter === "Все" || aggStatus === statusFilter;
      const matchQtr = quarterFilter === null || hasItemsInQuarter(p.items, quarterFilter);
      return matchQ && matchS && matchQtr;
    });
  }, [accessible, query, statusFilter, quarterFilter]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const isChildRoute = routerState.matches.length > 2;
  if (isChildRoute) {
    return <Outlet />;
  }

  const coachPlan = isCoach ? accessible.find((p) => p.year === new Date().getFullYear()) : null;

  return (
    <AppShell title="Планы мероприятий" subtitle="Планы тренеров на год">
      {isCoach ? (
        coachPlan ? (
          <CoachPlanView plan={coachPlan} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 shadow-[var(--shadow-card)]">
            <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-2 font-display text-xl font-bold text-secondary">У вас ещё нет плана на {new Date().getFullYear()} год</h3>
            <p className="mb-6 text-sm text-muted-foreground">Создайте план мероприятий на год, чтобы отслеживать соревнования, мастер-классы и сборы.</p>
            <Link to="/plans/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Создать план на год
              </Button>
            </Link>
          </div>
        )
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-secondary">Планы тренеров</h2>
              <p className="text-sm text-muted-foreground">
                {accessible.filter((p) => planAggregateStatus(p.items) === "submitted").length} ожидают проверки · {accessible.filter((p) => planAggregateStatus(p.items) === "approved").length} утверждено
              </p>
            </div>
          </div>

          <Card className="overflow-hidden shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
              <div className="relative md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по тренеру, ID…"
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statusFilters.map((s) => {
                  const cfg = s === "Все" ? { label: "Все", style: "" } : statusConfig[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        statusFilter === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                <span className="self-center text-xs text-muted-foreground">Квартал:</span>
                {quarterOptions.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuarterFilter(quarterFilter === q ? null : q)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      quarterFilter === q
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Тренер</th>
                    <th className="px-4 py-3 font-medium">Период</th>
                    <th className="px-4 py-3 font-medium">Вид спорта</th>
                    <th className="px-4 py-3 font-medium">Мероприятий</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const coveredQuarters = quarterOptions.filter((q) => hasItemsInQuarter(p.items, q));
                    return (
                    <tr key={p.id} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-[10px] font-bold text-primary-foreground">
                            {p.coachInitials}
                          </div>
                          <span className="font-medium text-secondary">{p.coachName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.periodLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.discipline}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.items.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(["draft", "submitted", "approved", "rejected"] as PlanStatus[]).map((s) => {
                            const count = itemStatusCounts(p.items)[s];
                            if (!count) return null;
                            return (
                              <Badge key={s} variant="outline" className={`font-normal text-[10px] ${statusConfig[s].style}`}>
                                {count} {statusConfig[s].label.toLowerCase()}
                              </Badge>
                            );
                          })}
                          {coveredQuarters.map((q) => (
                            <Badge key={q} variant="outline" className="font-normal text-[10px] border-border/50 bg-muted/30 text-muted-foreground">
                              {quarterLabel[q]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(p)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Открыть
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                        Ничего не найдено по выбранным фильтрам.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedPlan && (
            <PlanDetailModal
              plan={selectedPlan}
              isAdmin={isAdmin}
              isDirector={isDirector}
              onClose={() => setSelectedPlan(null)}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function CoachPlanView({ plan }: { plan: Plan }) {
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate((n) => n + 1);
  const [showForm, setShowForm] = useState(false);
  const [quarterFilter, setQuarterFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("Все");

  const submitItem = (item: PlanItem) => {
    item.status = "submitted";
    item.submittedAt = new Date().toLocaleDateString("ru-RU");
    rerender();
  };

  const removeItem = (item: PlanItem) => {
    if (item.status !== "draft") return;
    plan.items = plan.items.filter((i) => i !== item);
    rerender();
  };

  const addItem = (data: PlanItemForm) => {
    const newId = `PI-${String(plan.items.length + 1).padStart(3, "0")}`;
    const newItem: PlanItem = {
      id: newId,
      categoryId: data.categoryId,
      quarter: data.quarter,
      month: data.month,
      date: data.date,
      name: data.name,
      description: data.description,
      location: data.location,
      participantsCategory: data.participantsCategory,
      participantsCount: data.participantsCount,
      status: "draft",
    };
    plan.items.push(newItem);
    rerender();
    setShowForm(false);
  };

  const aggStatus = planAggregateStatus(plan.items);
  const aggCfg = statusConfig[aggStatus];

  const groupedByQuarter = useMemo(() => {
    const qMap = new Map<number, Map<string, typeof plan.items>>();
    for (const item of plan.items) {
      const q = item.quarter ?? monthToQuarter[item.month] ?? 1;
      if (!qMap.has(q)) qMap.set(q, new Map());
      const mMap = qMap.get(q)!;
      const existing = mMap.get(item.month) ?? [];
      existing.push(item);
      mMap.set(item.month, existing);
    }
    return [1, 2, 3, 4]
      .filter((q) => qMap.has(q))
      .map((q) => ({
        quarter: q,
        months: monthOrder.filter((m) => qMap.get(q)!.has(m)).map((m) => ({ month: m, items: qMap.get(q)!.get(m)! })),
      }));
  }, [plan.items]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">План мероприятий</h2>
          <p className="text-sm text-muted-foreground">
            {plan.coachName} · {plan.discipline} · {plan.periodLabel}
          </p>
        </div>
        <Badge variant="outline" className={`font-normal ${aggCfg.style}`}>
          {aggCfg.label}
        </Badge>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((s) => {
            const cfg = s === "Все" ? { label: "Все", style: "" } : statusConfig[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  statusFilter === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Квартал:</span>
          {quarterOptions.map((q) => (
            <button
              key={q}
              onClick={() => setQuarterFilter(quarterFilter === q ? null : q)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                quarterFilter === q
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {groupedByQuarter
          .filter((q) => !quarterFilter || q.quarter === quarterFilter)
          .map(({ quarter, months }) => {
            const filteredMonths = months
              .map((m) => ({
                ...m,
                items: statusFilter === "Все" ? m.items : m.items.filter((i) => i.status === statusFilter),
              }))
              .filter((m) => m.items.length > 0);
            if (filteredMonths.length === 0) return null;
            return <div key={quarter}>
            <h4 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-secondary">
              <LayoutList className="h-4 w-4 text-primary" />
              {quarterName[quarter]}
            </h4>
            <div className="space-y-6">
              {filteredMonths.map(({ month, items }) => (
                <div key={month}>
                  <h5 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-secondary/80">
                    <CalendarDays className="h-3.5 w-3.5 text-primary/60" />
                    {month}
                  </h5>
                  <div className="space-y-3">
                    {items.map((item) => {
                      const cat = planCategories[item.categoryId];
                      const cfg = statusConfig[item.status];
                      return (
                        <Card key={item.id} className={`border p-4 shadow-none ${item.status === "rejected" ? "border-destructive/30" : "border-border"}`}>
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                                {cat.shortLabel}
                              </Badge>
                              <Badge variant="outline" className={`font-normal ${cfg.style}`}>
                                {cfg.label}
                              </Badge>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{item.date}</span>
                          </div>
                          <p className="mb-1 font-medium text-secondary text-sm">{item.name}</p>
                          <p className="mb-2 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span><span className="font-medium text-foreground">Место:</span> {item.location}</span>
                            <span><span className="font-medium text-foreground">Участники:</span> {item.participantsCategory}</span>
                            <span><span className="font-medium text-foreground">Кол-во:</span> {item.participantsCount}</span>
                          </div>

                          {item.reviewerComment && (
                            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                              <p className="text-xs font-semibold text-destructive">Комментарий:</p>
                              <p className="mt-0.5 text-sm text-foreground">{item.reviewerComment}</p>
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                            {item.status === "draft" && (
                              <>
                                <Button size="sm" className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => submitItem(item)}>
                                  <Send className="mr-1 h-3 w-3" /> Отправить на проверку
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => removeItem(item)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {item.status === "submitted" && (
                              <span className="text-xs text-muted-foreground">Отправлено на проверку</span>
                            )}
                            {item.status === "approved" && (
                              <span className="text-xs text-muted-foreground">{item.reviewedAt ? `Утверждено ${item.reviewedAt}` : "Утверждено"}</span>
                            )}
                            {item.status === "rejected" && (
                              <span className="text-xs text-muted-foreground">{item.reviewedAt ? `Отклонено ${item.reviewedAt}` : "Отклонено"}</span>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        {showForm ? (
          <InlineItemForm
            planYear={plan.year}
            onSave={addItem}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)} className="border-dashed">
            <Plus className="mr-1.5 h-4 w-4" /> Добавить мероприятие
          </Button>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Тренер-преподаватель:</span> _______________ / {plan.coachName}
        </p>
      </div>
    </div>
  );
}

interface PlanItemForm {
  key: string;
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

function InlineItemForm({ planYear, onSave, onCancel }: { planYear: number; onSave: (data: PlanItemForm) => void; onCancel: () => void }) {
  const [data, setData] = useState<PlanItemForm>({
    key: "new",
    categoryId: "3",
    quarter: 1,
    month: "Январь",
    date: "",
    name: "",
    description: "",
    location: "",
    participantsCategory: "",
    participantsCount: "",
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const update = (field: keyof PlanItemForm, value: string | number) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const availableMonths = monthOptions.filter((m) => monthToQuarter[m] === data.quarter);

  const quarterFrom = new Date(planYear, (data.quarter - 1) * 3, 1);
  const quarterTo = new Date(planYear, data.quarter * 3, 0);
  const defaultMonthDate = new Date(planYear, monthOptions.indexOf(data.month), 1);

  const canSave = data.name.trim() && data.date.trim();

  return (
    <Card className="w-full border border-primary/30 p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Новое мероприятие</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория *</label>
          <select
            value={data.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
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
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Квартал *</label>
          <select
            value={data.quarter}
            onChange={(e) => {
              const newQuarter = Number(e.target.value);
              const monthsInQuarter = monthOptions.filter((m) => monthToQuarter[m] === newQuarter);
              const currentMonthInQuarter = monthsInQuarter.includes(data.month);
              setData((prev) => ({
                ...prev,
                quarter: newQuarter,
                month: currentMonthInQuarter ? prev.month : monthsInQuarter[0],
                ...(selectedDate || prev.date ? { date: "" } : {}),
              }));
              setSelectedDate(undefined);
            }}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>{q} кв.</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Месяц *</label>
          <select
            value={data.month}
            onChange={(e) => update("month", e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата *</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {data.date || <span className="text-muted-foreground">Выберите дату</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={ru}
                selected={selectedDate}
                onSelect={(d) => {
                  setSelectedDate(d);
                  if (d) update("date", format(d, "dd.MM.yyyy"));
                }}
                defaultMonth={defaultMonthDate}
                fromDate={quarterFrom}
                toDate={quarterTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Место проведения</label>
          <Input
            value={data.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="ЦСЕ, школа…"
            className="h-9"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Наименование мероприятия *</label>
        <Input
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Название мероприятия"
          className="h-9"
        />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Формат / содержание / цель</label>
        <textarea
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Опишите формат, содержание и цель мероприятия…"
          className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          rows={2}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория участников</label>
          <Input
            value={data.participantsCategory}
            onChange={(e) => update("participantsCategory", e.target.value)}
            placeholder="Спортсмены ЦСЕ, школьники…"
            className="h-9"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Количество участников</label>
          <Input
            value={data.participantsCount}
            onChange={(e) => update("participantsCount", e.target.value)}
            placeholder="20"
            className="h-9"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Button size="sm" className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90" disabled={!canSave} onClick={() => canSave && onSave(data)}>
          <Plus className="mr-1 h-3 w-3" /> Добавить
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </Card>
  );
}

const monthOptions = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const monthOrder = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const quarterName: Record<number, string> = {
  1: "I квартал", 2: "II квартал", 3: "III квартал", 4: "IV квартал",
};

const monthToQuarter: Record<string, number> = {
  "Январь": 1, "Февраль": 1, "Март": 1,
  "Апрель": 2, "Май": 2, "Июнь": 2,
  "Июль": 3, "Август": 3, "Сентябрь": 3,
  "Октябрь": 4, "Ноябрь": 4, "Декабрь": 4,
};

function PlanDetailModal({ plan, isAdmin, isDirector, onClose }: { plan: Plan; isAdmin: boolean; isDirector: boolean; onClose: () => void }) {
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate((n) => n + 1);

  const groupedByQuarter = useMemo(() => {
    const qMap = new Map<number, Map<string, typeof plan.items>>();
    for (const item of plan.items) {
      const q = item.quarter ?? monthToQuarter[item.month] ?? 1;
      if (!qMap.has(q)) qMap.set(q, new Map());
      const mMap = qMap.get(q)!;
      const existing = mMap.get(item.month) ?? [];
      existing.push(item);
      mMap.set(item.month, existing);
    }
    return [1, 2, 3, 4]
      .filter((q) => qMap.has(q))
      .map((q) => ({
        quarter: q,
        months: monthOrder.filter((m) => qMap.get(q)!.has(m)).map((m) => ({ month: m, items: qMap.get(q)!.get(m)! })),
      }));
  }, [plan.items]);

  const submitItem = (item: PlanItem) => {
    item.status = "submitted";
    item.submittedAt = new Date().toLocaleDateString("ru-RU");
    rerender();
  };

  const approveItem = (item: PlanItem) => {
    item.status = "approved";
    item.reviewedAt = new Date().toLocaleDateString("ru-RU");
    item.reviewerName = "Администратор";
    rerender();
  };

  const rejectItem = (item: PlanItem) => {
    item.status = "rejected";
    item.reviewedAt = new Date().toLocaleDateString("ru-RU");
    item.reviewerName = "Администратор";
    rerender();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">План мероприятий</h3>
            <p className="text-sm text-muted-foreground">
              {plan.coachName} · {plan.discipline} · {plan.periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Items by quarter → month */}
        <div className="space-y-8 px-6 py-4">
          {groupedByQuarter.map(({ quarter, months }) => (
            <div key={quarter}>
              <h4 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-secondary">
                <LayoutList className="h-4 w-4 text-primary" />
                {quarterName[quarter]}
              </h4>
              <div className="space-y-6">
                {months.map(({ month, items }) => (
                  <div key={month}>
                    <h5 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-secondary/80">
                      <CalendarDays className="h-3.5 w-3.5 text-primary/60" />
                      {month}
                    </h5>
                    <div className="space-y-3">
                      {items.map((item) => {
                  const cat = planCategories[item.categoryId];
                  const cfg = statusConfig[item.status];
                  return (
                    <Card key={item.id} className={`border p-4 shadow-none ${item.status === "rejected" ? "border-destructive/30" : "border-border"}`}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                            {cat.shortLabel}
                          </Badge>
                          <Badge variant="outline" className={`font-normal ${cfg.style}`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.date}</span>
                      </div>
                      <p className="mb-1 font-medium text-secondary text-sm">{item.name}</p>
                      <p className="mb-2 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span><span className="font-medium text-foreground">Место:</span> {item.location}</span>
                        <span><span className="font-medium text-foreground">Участники:</span> {item.participantsCategory}</span>
                        <span><span className="font-medium text-foreground">Кол-во:</span> {item.participantsCount}</span>
                      </div>

                      {/* Rejection comment */}
                      {item.reviewerComment && (
                        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                          <p className="text-xs font-semibold text-destructive">Комментарий:</p>
                          <p className="mt-0.5 text-sm text-foreground">{item.reviewerComment}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                        {/* Coach: submit draft item */}
                        {!isAdmin && !isDirector && item.status === "draft" && (
                          <Button size="sm" className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => submitItem(item)}>
                            <Send className="mr-1 h-3 w-3" /> Отправить на проверку
                          </Button>
                        )}
                        {/* Admin: approve/reject submitted item */}
                        {isAdmin && item.status === "submitted" && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 border-destructive text-xs text-destructive hover:bg-destructive/10" onClick={() => rejectItem(item)}>
                              <XCircle className="mr-1 h-3 w-3" /> Отклонить
                            </Button>
                            <Button size="sm" className="h-8 bg-[color:var(--success)] text-xs text-white hover:bg-[color:var(--success)]/90" onClick={() => approveItem(item)}>
                              <CheckCircle className="mr-1 h-3 w-3" /> Утвердить
                            </Button>
                          </>
                        )}
                        {/* Info for other states */}
                        {item.status === "submitted" && !isAdmin && (
                          <span className="text-xs text-muted-foreground">Отправлено на проверку</span>
                        )}
                        {item.status === "approved" && (
                          <span className="text-xs text-muted-foreground">{item.reviewedAt ? `Утверждено ${item.reviewedAt}` : "Утверждено"}</span>
                        )}
                        {item.status === "rejected" && (
                          <span className="text-xs text-muted-foreground">{item.reviewedAt ? `Отклонено ${item.reviewedAt}` : "Отклонено"}</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Signature */}
        <div className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Тренер-преподаватель:</span> _______________ / {plan.coachName}
        </div>
      </div>
    </div>
  );
}
