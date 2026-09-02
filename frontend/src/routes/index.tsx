import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Trophy,
  Users,
  CalendarDays,
  Medal,
  TrendingUp,
  Clock,
  ClipboardList,
  Dumbbell,
  AlertTriangle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchPlans, monthName, type Plan } from "@/lib/api/plans.functions";
import { fetchCriteria, type CoachTier, type IncentiveCriteria } from "@/lib/api/criteria.functions";
import { apiFetch } from "@/lib/api/client";
import { planAggregateStatus, planDeadlineInfo, statusConfig } from "@/routes/plans";
import { fetchAthletes } from "@/lib/api/athletes.functions";
import { fetchCompetitions } from "@/lib/api/events.functions";
import { fetchCenters } from "@/lib/api/organizations.functions";
import { fetchAnalyticsSummary, type AnalyticsSummaryDto } from "@/lib/api/analytics.functions";
import { fetchSchedulePeriods, type SchedulePeriodDto } from "@/lib/api/schedules.functions";
import { fetchAttendance } from "@/lib/api/attendance.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Дашборд — СОКОЛ" },
      { name: "description", content: "Сводка по спортсменам, медалям и соревнованиям." },
    ],
  }),
  component: Dashboard,
});

const toneStyles: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent-foreground",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Dashboard() {
  const { loading } = useAuthGuard();
  const { isDirector, isCoach, isAdmin, user } = useAuth();

  const coachName = user?.coachName;

  const [myPlan, setMyPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [plansError, setPlansError] = useState("");
  const [criteria, setCriteria] = useState<IncentiveCriteria | null>(null);
  const [criteriaError, setCriteriaError] = useState("");
  const [payoutRange, setPayoutRange] = useState<{ min: number; max: number } | null>(null);
  const [coachTier, setCoachTier] = useState<CoachTier | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCriteria();
        if (cancelled) return;
        const rec = list[0] ?? null;
        setCriteria(rec);
        setCoachTier(rec?.assigned_tier ?? null);
        setCriteriaError("");
        try {
          const programs = await apiFetch<{ status: string; min_payout: number; max_payout: number }[]>("/incentive/programs");
          const active = programs.find((p) => p.status === "active");
          if (!cancelled && active) {
            setPayoutRange({ min: active.min_payout, max: active.max_payout });
          }
        } catch {
          /* суммы — необязательный блок */
        }
      } catch {
        if (!cancelled) setCriteriaError("Не удалось загрузить критерии.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPlans();
        if (cancelled) return;
        setAllPlans(list);
        setPlansError("");
        const mine = list.find((p) => p.coachId === user?.id && p.year === new Date().getFullYear()) ?? null;
        setMyPlan(mine);
      } catch {
        if (!cancelled) setPlansError("Не удалось загрузить планы мероприятий.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  // --- API data ---
  const [athletesData, setAthletesData] = useState<any[]>([]);
  const [competitionsData, setCompetitionsData] = useState<any[]>([]);
  const [centersData, setCentersData] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummaryDto | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAthletes();
        if (cancelled) return;
        setAthletesData(list.items);
      } catch {
        setAthletesData([]);
      }
    })();
    return () => { cancelled = true };
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCompetitions();
        if (cancelled) return;
        setCompetitionsData(list);
      } catch {
        setCompetitionsData([]);
      }
    })();
    return () => { cancelled = true };
  }, [loading]);

  useEffect(() => {
    if (loading || !isDirector) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCenters();
        if (cancelled) return;
        setCentersData(list);
      } catch {
        setCentersData([]);
      }
    })();
    return () => { cancelled = true };
  }, [loading, isDirector]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await fetchAnalyticsSummary();
        if (cancelled) return;
        setAnalyticsData(summary);
      } catch {
        setAnalyticsData(null);
      }
    })();
    return () => { cancelled = true };
  }, [loading]);

  const [disciplineMix, setDisciplineMix] = useState<any[]>([]);
  const [monthlyResults, setMonthlyResults] = useState<any[]>([]);

  // --- computed from API + mock ---
  useEffect(() => {
    if (analyticsData) {
      // disciplineMix: athletes_by_discipline → {name, value}
      const disciplineMix = analyticsData.athletes_by_discipline.map(
        (d: { name: string; value: number }) => ({
          name: d.name,
          value: d.value,
        }),
      );
      // monthlyResults: medal_dynamics → {month, gold, silver, bronze}
      const monthlyResults = analyticsData.medal_dynamics.map(
        (m: { month: string; gold: number; silver: number; bronze: number }) => ({
          month: m.month,
          gold: m.gold,
          silver: m.silver,
          bronze: m.bronze,
        }),
      );
      setDisciplineMix(disciplineMix);
      setMonthlyResults(monthlyResults);
    }
  }, [analyticsData]);

  const topAthletes = analyticsData?.top_athletes ?? [];

  const summaryKpis = useMemo(() => {
    if (!analyticsData) return null;
    const medals = analyticsData.kpis.medals;
    const avgPoints = analyticsData.top_athletes.length
      ? Math.round(
          analyticsData.top_athletes.reduce((s, a) => s + a.points, 0) /
            analyticsData.top_athletes.length,
        )
      : 0;
    return [
      { label: "Спортсменов в системе", value: analyticsData.kpis.athletes, icon: Users, tone: "primary" as const },
      { label: "Медалей за сезон", value: medals.gold + medals.silver + medals.bronze, icon: Medal, tone: "accent" as const },
      { label: "Активных соревнований", value: analyticsData.kpis.competitions, icon: Trophy, tone: "secondary" as const },
      { label: "Средний рейтинг", value: avgPoints, icon: TrendingUp, tone: "success" as const },
    ];
  }, [analyticsData]);

  /* Coach-specific data */
  const [activePeriods, setActivePeriods] = useState<SchedulePeriodDto[]>([]);
  const [attendancePct, setAttendancePct] = useState(0);

  useEffect(() => {
    if (loading || !isCoach || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchSchedulePeriods({ coach_user_id: user.id, status: "active" });
        if (!cancelled) setActivePeriods(list);
      } catch {
        if (!cancelled) setActivePeriods([]);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, isCoach, user?.id]);

  useEffect(() => {
    if (loading || !isCoach || !user?.id) return;
    let cancelled = false;
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (async () => {
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        const records = await fetchAttendance({
          coachUserId: user.id,
          dateFrom: iso(start),
          dateTo: iso(end),
          perPage: 500,
        });
        if (!cancelled) {
          const total = records.items.length;
          const present = records.items.filter((r) => r.status === "present").length;
          setAttendancePct(total === 0 ? 0 : Math.round((present / total) * 100));
        }
      } catch {
        if (!cancelled) setAttendancePct(0);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, isCoach, user?.id]);

  const myAthletes = useMemo(
    () => (coachName ? athletesData.filter((a) => a.coach_user_id ? a.coach_user_id === coachName : a.coach_id === coachName).sort((a, b) => b.rating - a.rating) : []),
    [coachName, athletesData],
  );
  const myTodayLessons = useMemo(() => {
    if (!isCoach) return [];
    const jsDay = new Date().getDay();
    const dow = jsDay === 0 ? 7 : jsDay;
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const lessons: {
      id: string;
      groupName: string;
      startTime: string;
      endTime: string;
      room: string | null;
      discipline: string | null;
    }[] = [];
    for (const p of activePeriods) {
      if (!p.period_start || !p.period_end) continue;
      if (todayISO < p.period_start || todayISO > p.period_end) continue;
      for (const item of p.items ?? []) {
        if (item.day_of_week !== dow) continue;
        lessons.push({
          id: `${p.id}-${item.id}`,
          groupName: p.group_name ?? "—",
          startTime: item.start_time,
          endTime: item.end_time,
          room: item.room,
          discipline: p.discipline,
        });
      }
    }
    lessons.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return lessons;
  }, [isCoach, activePeriods]);
  const totalMedals = useMemo(() => {
    return myAthletes.reduce(
      (s, a) => s + (a.medals?.gold ?? 0) + (a.medals?.silver ?? 0) + (a.medals?.bronze ?? 0),
      0,
    );
  }, [myAthletes]);

  const myCompetitions = useMemo(
    () => (user?.id ? competitionsData.filter((c) => c.coach_id === user.id) : []),
    [user?.id],
  );

  const dayLabels: Record<number, string> = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт" };
  const todayLabel = dayLabels[new Date().getDay() === 0 ? 5 : new Date().getDay() === 6 ? 1 : new Date().getDay()] ?? "Пн";

  const centerStats = useMemo(() => {
    return centersData.map((c) => {
      const centerAthletes = athletesData.filter((a) => a.center_id === c.id);
      const uniqueCities = [...new Set(centerAthletes.map((a) => a.center_city).filter(Boolean))];
      const coachesCount = new Set(centerAthletes.map((a) => a.coach_id).filter(Boolean)).size;
      return { ...c, cities: uniqueCities, athletesCount: centerAthletes.length, coachesCount };
    });
  }, [centersData, athletesData]);

  const myPlanSummary = useMemo(() => {
    if (!myPlan || myPlan.items.length === 0) return null;
    const qCounts = [1, 2, 3, 4]
      .map((quarter) => ({ quarter, count: myPlan.items.filter((i) => i.quarter === quarter).length }))
      .filter((x) => x.count > 0);
    return {
      plan: myPlan,
      qCounts,
      agg: planAggregateStatus(myPlan.items),
      deadline: planDeadlineInfo(myPlan, new Date()),
    };
  }, [myPlan]);

  const criteriaMetrics = useMemo(() => {
    if (!isCoach) return null;
    const mName = monthName(new Date().getMonth() + 1);
    const monthItems = (myPlan?.items ?? []).filter(
      (i) => i.month === mName && (i.status === "approved" || i.status === "submitted"),
    );
    const countBy = (cat: string) => monthItems.filter((i) => i.categoryId === cat).length;
    return {
      athletes: myAthletes.filter((a) => a.age <= 21).length,
      hours: 0,
      socialEvents: countBy("3"),
      sportEvents: countBy("4"),
      developmentEvents: countBy("5"),
    };
  }, [isCoach, myPlan, myAthletes]);

  const planDeadlines = useMemo(() => {
    if (isCoach) return [];
    const now = new Date();
    const list = allPlans
      .map((p) => {
        if (isAdmin && user?.centerId && p.centerId !== user.centerId) return null;
        return { plan: p, info: planDeadlineInfo(p, now) };
      })
      .filter((x): x is { plan: Plan; info: NonNullable<ReturnType<typeof planDeadlineInfo>> } =>
        x !== null && x.info !== null,
      );
    list.sort((a, b) =>
      a.info.tone === b.info.tone
        ? a.info.text.localeCompare(b.info.text)
        : a.info.tone === "overdue" ? -1 : 1,
    );
    return list;
  }, [allPlans, isCoach, isAdmin, user?.centerId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Дашборд" subtitle="Оперативная сводка по сборной">
      {/* Hero banner — director sees centers overview instead */}
      {isDirector ? (
        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-secondary">Центры «Сокол»</h2>
              <p className="text-sm text-muted-foreground">Сводка по всем филиалам</p>
            </div>
            <Badge className="border-0 bg-accent text-accent-foreground">Сезон 2025/26</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {centerStats.map((c) => (
              <Card key={c.id} className="overflow-hidden border-l-4 border-l-secondary shadow-[var(--shadow-card)]">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-secondary">{c.name}</h3>
                    <span className="text-xs text-muted-foreground">{c.cities.join(", ") || c.city}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.address}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="text-lg font-bold text-secondary">{c.athletesCount}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Спортсменов</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="text-lg font-bold text-secondary">{c.coachesCount}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Тренеров</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="truncate text-lg font-bold text-secondary">{c.center_type || "—"}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Тип центра</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="text-lg font-bold text-accent">{c.is_active ? "Активен" : "Неактивен"}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Статус</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>{c.email || "Нет e-mail"}</span>
                    <span>{c.phone || "—"}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : isCoach ? (
        <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]">
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="max-w-xl">
              <Badge className="mb-3 border-0 bg-accent text-accent-foreground hover:bg-accent">Мой профиль</Badge>
              <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">
                {user?.firstName} {user?.lastName}, добро пожаловать!
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/80">
                {user?.coachDiscipline} · {myAthletes.length} спортсменов · {totalMedals} медалей · Посещаемость {attendancePct}%
              </p>
            </div>
          </div>
        </section>
      ) : (
<section className="mb-6 overflow-hidden rounded-2xl border border-border bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="max-w-xl">
            <Badge className="mb-3 border-0 bg-accent text-accent-foreground hover:bg-accent">Сезон 2025/26</Badge>
            <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">
              В системе {summaryKpis ? summaryKpis[0].value.toLocaleString("ru-RU") : "—"}{" "}
              спортсменов, {summaryKpis ? summaryKpis[1].value.toLocaleString("ru-RU") : "—"} медалей за сезон.
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Активных соревнований: {summaryKpis ? summaryKpis[2].value.toLocaleString("ru-RU") : "—"}.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => { window.location.href = "/reports"; }}>Открыть отчёт <ArrowUpRight className="ml-1 h-4 w-4" /></Button>
            <Button variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground" onClick={() => { window.location.href = "/schedules"; }}>Календарь</Button>
          </div>
        </div>
      </section>
      )}

      {/* Coach KPIs */}
      {isCoach ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-secondary">{myAthletes.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Мои спортсмены</div>
          </Card>
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                <Dumbbell className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-secondary">{myTodayLessons.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Занятий сегодня</div>
          </Card>
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Medal className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-secondary">{totalMedals}</div>
            <div className="mt-1 text-xs text-muted-foreground">Всего медалей</div>
          </Card>
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--success)]/15 text-[color:var(--success)]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                attendancePct >= 80 ? "bg-[color:var(--success)]/10 text-[color:var(--success)]" : "bg-destructive/10 text-destructive"
              }`}>
                {attendancePct}%
              </span>
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-secondary">{Math.round(myAthletes.reduce((s, a) => s + a.rating, 0) / (myAthletes.length || 1))}</div>
            <div className="mt-1 text-xs text-muted-foreground">Ср. рейтинг</div>
          </Card>
        </section>
      ) : (
      /* KPIs */
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryKpis ? summaryKpis.map((k) => (
          <Card key={k.label} className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneStyles[k.tone]}`}>
                <k.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-secondary">{k.value.toLocaleString("ru-RU")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.label}</div>
          </Card>
        )) : [0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted" />
            <div className="mt-4 font-display text-2xl font-bold text-secondary">—</div>
            <div className="mt-1 text-xs text-muted-foreground">Загрузка…</div>
          </Card>
        ))}
      </section>
      )}

      {/* Incentive Program Criteria Summary (v8) — Coach only */}
      {isCoach && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-sm font-bold text-secondary">Критерии материального стимулирования</h3>
            {coachTier && payoutRange && (
              <Badge variant="outline" className={
                coachTier === "full"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-sky-50 text-sky-700 border-sky-200"
              }>
                {coachTier === "full"
                  ? `Полная выплата ${money.format(payoutRange.max)}`
                  : `Базовая выплата ${money.format(payoutRange.min)}`}
              </Badge>
            )}
          </div>
          <Card className="border border-border p-4 shadow-none">
            {!criteria ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {criteriaError
                  ? criteriaError
                  : "Критерии ещё не утверждены руководителем центра. Нормы появятся здесь после утверждения."}
              </div>
            ) : !coachTier ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Выплата по отчёту не назначена: руководитель центра ещё не выбрал базовый или полный тир для вашего
                профиля. Обратитесь к руководителю центра.
              </div>
            ) : (
              <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: "Спортсмены (до 21 года)", current: criteriaMetrics?.athletes ?? 0, norm: coachTier === "full" ? criteria.athletes_full : criteria.athletes_basic, unit: "чел." },
                  { label: "Часы тренировок", current: 0, norm: coachTier === "full" ? criteria.hours_full : criteria.hours_basic, unit: "ч/нед", note: "по расписанию" },
                  { label: "Мероприятия с особыми категориями", current: criteriaMetrics?.socialEvents ?? 0, norm: coachTier === "full" ? criteria.social_events_full : criteria.social_events_basic, unit: "меропр./мес" },
                  { label: "Спортивные мероприятия", current: criteriaMetrics?.sportEvents ?? 0, norm: coachTier === "full" ? criteria.sports_events_full : criteria.sports_events_basic, unit: "меропр./мес" },
                  { label: "Мероприятия развития спортсменов", current: criteriaMetrics?.developmentEvents ?? 0, norm: coachTier === "full" ? criteria.development_events_full : criteria.development_events_basic, unit: "меропр./мес" },
                ].map((c) => {
                  const pct = c.norm > 0 ? Math.min((c.current / c.norm) * 100, 100) : 0;
                  const meets = c.norm > 0 && c.current >= c.norm;
                  return (
                    <div key={c.label} className="space-y-1.5">
                      <div className="text-xs font-medium text-secondary">{c.label}</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-lg font-bold text-secondary">{c.current}</span>
                        <span className="text-xs text-muted-foreground">/ {c.norm} {c.unit}</span>
                      </div>
                      {c.note && <div className="text-[10px] text-muted-foreground">{c.note}</div>}
                      <div className="h-1.5 w-full rounded-full bg-muted/40">
                        <div
                          className={`h-full rounded-full transition-all ${meets ? "bg-emerald-500" : "bg-red-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {meets
                          ? coachTier === "full"
                            ? `≥${money.format(payoutRange?.max ?? 50000)} ✓`
                            : `≥${money.format(payoutRange?.min ?? 25000)} ✓`
                          : "ниже нормы"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-border pt-2 text-[10px] text-muted-foreground/60">
                Нормы утверждены руководителем центра. Ваш тир — «{coachTier === "full" ? "полный" : "базовый"}»: выплата
                рассчитывается по нормам {coachTier === "full" ? "полного" : "базового"} уровня активной программы; без
                назначенного тира отчёт не формирует выплату. Часы — по расписанию, будет уточнено после подключения данных.
              </div>
              </>
            )}
          </Card>
        </section>
      )}

      {/* Coach: My athletes + today's schedule + plans */}
      {isCoach ? (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="p-5 shadow-[var(--shadow-card)] lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-secondary">Мои спортсмены</h3>
                <Button variant="ghost" size="sm" className="text-primary"
                  onClick={() => window.location.href = "/athletes"}
                >
                  Все <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              {myAthletes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Нет спортсменов</p>
              ) : (
              <ul className="divide-y divide-border">
                {myAthletes.slice(0, 5).map((a, i) => (
                  <li key={a.id} className="flex items-center gap-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary font-display text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-secondary">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.discipline} · {a.rank} · {a.city}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="outline" className={`font-normal ${
                        a.status === "Активный" ? "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
                        : a.status === "Травма" ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-muted text-muted-foreground border-border"
                      }`}>{a.status}</Badge>
                    </div>
                    <div className="font-display text-base font-bold text-primary">{a.rating}</div>
                  </li>
                ))}
              </ul>
              )}
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="p-5 shadow-[var(--shadow-card)]">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-bold text-secondary">{todayLabel} — занятия</h3>
                </div>
                {myTodayLessons.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Занятий нет</p>
                ) : (
                <ul className="space-y-3">
                  {myTodayLessons.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-secondary">{s.groupName}</div>
                        <div className="text-xs text-muted-foreground">{s.startTime}–{s.endTime} · {s.room ?? "—"}</div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">{s.discipline ?? "—"}</div>
                    </li>
                  ))}
                </ul>
                )}
              </Card>

              <Card className="p-5 shadow-[var(--shadow-card)]">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-bold text-secondary">Планы мероприятий</h3>
                </div>
                {plansError ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{plansError}</p>
                ) : !myPlanSummary ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Нет планов на {new Date().getFullYear()} год</p>
                ) : (
                  <div>
                    <div className="text-sm font-semibold text-secondary">{myPlanSummary.plan.periodLabel}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {myPlanSummary.qCounts.map(({ quarter, count }) => (
                        <Badge key={quarter} variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                          {quarter} кв: {count}
                        </Badge>
                      ))}
                      <Badge variant="outline" className={`font-normal ${statusConfig[myPlanSummary.agg].style}`}>
                        {statusConfig[myPlanSummary.agg].label}
                      </Badge>
                    </div>
                    {myPlanSummary.deadline && (
                      <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
                        myPlanSummary.deadline.tone === "overdue" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                      }`}>
                        <AlertTriangle className="h-3 w-3 shrink-0" /> {myPlanSummary.deadline.text}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </section>

          {/* Coach: My competitions */}
          <div className="mt-6">
            <Card className="p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-secondary">Мои соревнования</h3>
              </div>
              {myCompetitions.filter((c) => c.status !== "cancelled" && new Date(`${c.end_date}T00:00:00`).getTime() >= startOfToday()).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Нет предстоящих соревнований</p>
              ) : (
                <ul className="space-y-3">
                  {myCompetitions.filter((c) => {
                    const end = new Date(`${c.end_date}T00:00:00`);
                    return c.status !== "cancelled" && end.getTime() >= startOfToday();
                  }).slice(0, 5).map((ev) => (
                    <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-secondary">{ev.name}</div>
                        <div className="text-xs text-muted-foreground">{ev.city} · {new Date(ev.start_date).toLocaleDateString("ru-RU")}</div>
                      </div>
                      <div className="shrink-0 rounded-md bg-accent/15 px-2.5 py-1 text-xs font-bold text-secondary">
                        {ev.level}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : (
      <>
      {/* Plan deadlines (admin / director) */}
      {planDeadlines.length > 0 && (
        <section className="mt-6">
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-secondary">Дедлайны планов</h3>
            </div>
            <ul className="space-y-3">
              {planDeadlines.slice(0, 8).map(({ plan, info }) => (
                <li
                  key={plan.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
                    info.tone === "overdue"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-amber-300 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-secondary">{plan.coachName}</div>
                    <div className="text-xs text-muted-foreground">{plan.periodLabel} · {plan.discipline}</div>
                  </div>
                  <div className={`shrink-0 text-right text-xs font-semibold ${
                    info.tone === "overdue" ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                  }`}>
                    <AlertTriangle className="mr-1 inline h-3 w-3" /> {info.text}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Charts */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-secondary">Медали по месяцам</h3>
              <p className="text-xs text-muted-foreground">Сезон 2025/26</p>
            </div>
            <div className="flex gap-3 text-xs">
              <Legend dot="var(--color-chart-1)" label="Золото" />
              <Legend dot="var(--color-chart-2)" label="Серебро" />
              <Legend dot="var(--color-chart-4)" label="Бронза" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyResults} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="gold" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="silver" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#g2)" />
                <Area type="monotone" dataKey="bronze" stroke="var(--color-chart-4)" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-base font-bold text-secondary">Состав по дисциплинам</h3>
          <p className="text-xs text-muted-foreground">Доля спортсменов</p>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={disciplineMix}
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                >
                  {disciplineMix.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {disciplineMix.map((d) => (
              <li key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="font-medium text-muted-foreground">{d.value}%</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Bottom row */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-secondary">Топ-5 спортсменов по очкам</h3>
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => { window.location.href = "/athletes"; }}>Все <ArrowUpRight className="ml-1 h-3 w-3" /></Button>
          </div>
          {topAthletes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Нет данных по спортсменам</p>
          ) : (
          <ul className="divide-y divide-border">
            {topAthletes.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex items-center gap-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary font-display text-sm font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-secondary">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[a.discipline, a.rank].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="hidden text-xs text-muted-foreground sm:block">{a.medals.gold}G · {a.medals.silver}S · {a.medals.bronze}B</div>
                <div className="font-display text-base font-bold text-primary">{a.points}</div>
              </li>
            ))}
          </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-secondary">Ближайшие старты</h3>
            </div>
            <ul className="space-y-3">
              {competitionsData.filter((c) => c.status !== "cancelled" && new Date(`${c.end_date}T00:00:00`).getTime() >= startOfToday()).slice(0, 3).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-secondary">{ev.name}</div>
                    <div className="text-xs text-muted-foreground">{ev.city} · {new Date(ev.start_date).toLocaleDateString("ru-RU")}</div>
                  </div>
                  <div className="shrink-0 rounded-md bg-accent/15 px-2.5 py-1 text-xs font-bold text-secondary">
                    {ev.competitions.reduce((s: number, x: any) => s + (x.participants?.length ?? 0), 0)} участ.
                  </div>
                </li>
              ))}
              {competitionsData.filter((c) => c.status !== "cancelled" && new Date(`${c.end_date}T00:00:00`).getTime() >= startOfToday()).length === 0 && (
                <li className="py-4 text-center text-sm text-muted-foreground">Нет предстоящих стартов</li>
              )}
            </ul>
          </Card>
        </div>
      </section>
      </>
      )}
    </AppShell>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}
