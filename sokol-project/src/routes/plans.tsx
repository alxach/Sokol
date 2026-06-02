import { useState, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Search, CheckCircle, XCircle, Send, Eye, CalendarDays } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plans, planCategories, planCategoryKeys, type Plan, type PlanStatus, type PlanCategoryId } from "@/lib/mock-data";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Планы мероприятий — СОКОЛ" },
      { name: "description", content: "Планы мероприятий тренеров на квартал." },
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

function PlansPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach } = useAuth();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");
  const [quarterFilter, setQuarterFilter] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const accessible = useMemo(() => {
    if (!user) return [];
    if (isCoach) return plans.filter((p) => p.coachId === user.id);
    if (isAdmin && user?.centerId) return plans.filter((p) => p.centerId === user.centerId);
    return plans;
  }, [isCoach, isAdmin, user]);

  const filtered = useMemo(() => {
    return accessible.filter((p) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q || p.coachName.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.discipline.toLowerCase().includes(q);
      const matchS = statusFilter === "Все" || p.status === statusFilter;
      const matchQtr = quarterFilter === null || p.quarter === quarterFilter;
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

  return (
    <AppShell title="Планы мероприятий" subtitle="Планы тренеров на квартал">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Планы тренеров</h2>
          <p className="text-sm text-muted-foreground">
            {accessible.filter((p) => p.status === "submitted").length} ожидают проверки · {accessible.filter((p) => p.status === "approved").length} утверждено
          </p>
        </div>
        {isCoach && (
          <Link to="/plans/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Создать план
            </Button>
          </Link>
        )}
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
              {filtered.map((p) => (
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
                    <Badge variant="outline" className={`font-normal ${statusConfig[p.status].style}`}>
                      {statusConfig[p.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(p)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Открыть
                    </Button>
                  </td>
                </tr>
              ))}
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
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </AppShell>
  );
}

const monthOrder = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function PlanDetailModal({ plan, isAdmin, onClose }: { plan: Plan; isAdmin: boolean; onClose: () => void }) {
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, typeof plan.items>();
    for (const item of plan.items) {
      const existing = map.get(item.month) ?? [];
      existing.push(item);
      map.set(item.month, existing);
    }
    return monthOrder.filter((m) => map.has(m)).map((m) => ({ month: m, items: map.get(m)! }));
  }, [plan.items]);

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
            <Badge variant="outline" className={`font-normal ${statusConfig[plan.status].style}`}>
              {statusConfig[plan.status].label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Period info */}
        <div className="border-b border-border px-6 py-3 text-sm text-muted-foreground">
          Период: <span className="font-medium text-foreground">{plan.periodLabel}</span>
          {plan.submittedAt && <> · Отправлен: <span className="font-medium text-foreground">{plan.submittedAt}</span></>}
          {plan.reviewedAt && <> · Проверен: <span className="font-medium text-foreground">{plan.reviewedAt}</span></>}
        </div>

        {/* Items by month */}
        <div className="space-y-6 px-6 py-4">
          {groupedByMonth.map(({ month, items }) => (
            <div key={month}>
              <h4 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-secondary">
                <CalendarDays className="h-4 w-4 text-primary" />
                {month}
              </h4>
              <div className="space-y-3">
                {items.map((item) => {
                  const cat = planCategories[item.categoryId];
                  return (
                    <Card key={item.id} className="border border-border p-4 shadow-none">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                          {cat.shortLabel}
                        </Badge>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.date}</span>
                      </div>
                      <p className="mb-1 font-medium text-secondary text-sm">{item.name}</p>
                      <p className="mb-2 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span><span className="font-medium text-foreground">Место:</span> {item.location}</span>
                        <span><span className="font-medium text-foreground">Участники:</span> {item.participantsCategory}</span>
                        <span><span className="font-medium text-foreground">Кол-во:</span> {item.participantsCount}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Reviewer comment */}
        {plan.reviewerComment && (
          <div className="mx-6 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <XCircle className="h-3.5 w-3.5" /> Комментарий проверяющего
            </div>
            <p className="mt-1 text-sm text-foreground">{plan.reviewerComment}</p>
            {plan.reviewerName && <p className="mt-1 text-xs text-muted-foreground">— {plan.reviewerName}</p>}
          </div>
        )}

        {/* Signature */}
        <div className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Тренер-преподаватель:</span> _______________ / {plan.coachName}
        </div>

        {/* Actions */}
        {isAdmin && plan.status === "submitted" && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
              <XCircle className="mr-1.5 h-4 w-4" /> Отклонить
            </Button>
            <Button className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90">
              <CheckCircle className="mr-1.5 h-4 w-4" /> Утвердить
            </Button>
          </div>
        )}

        {plan.status === "draft" && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Link to="/plans/new">
              <Button variant="outline">Редактировать</Button>
            </Link>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="mr-1.5 h-4 w-4" /> Отправить на проверку
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
