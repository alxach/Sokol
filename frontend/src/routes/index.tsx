import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
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
  Activity,
  CalendarDays,
  Medal,
  TrendingUp,
  Clock,
  ClipboardList,
  Dumbbell,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { useCenter } from "@/lib/center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  athletes,
  schedules,
  schedulePeriods,
  attendanceRecords,
  plans,
  disciplineMix,
  monthlyResults,
  recentActivity,
  competitions,
  centers,
  getCenterIdByCity,
  getPeriodStatus,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Дашборд — СОКОЛ" },
      { name: "description", content: "Сводка по спортсменам, медалям и соревнованиям." },
    ],
  }),
  component: Dashboard,
});

const kpis = [
  { label: "Спортсменов в системе", value: "1 284", delta: "+4.2%", icon: Users, tone: "primary" as const },
  { label: "Медалей за сезон", value: "342", delta: "+18%", icon: Medal, tone: "accent" as const },
  { label: "Активных соревнований", value: "27", delta: "+3", icon: Trophy, tone: "secondary" as const },
  { label: "Средний рейтинг", value: "1 728", delta: "+62", icon: TrendingUp, tone: "success" as const },
];

const toneStyles: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent-foreground",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
};

function Dashboard() {
  const { loading } = useAuthGuard();
  const { isDirector, isCoach, user } = useAuth();
  const { selectedCenterId } = useCenter();

  const coachName = user?.coachName;

  const topAthletes = [...athletes].sort((a, b) => b.rating - a.rating).slice(0, 5);

  /* Coach-specific data */
  const myAthletes = useMemo(
    () => (coachName ? athletes.filter((a) => a.coach === coachName).sort((a, b) => b.rating - a.rating) : []),
    [coachName],
  );
  const mySchedulesToday = useMemo(() => {
    if (!coachName) return [];
    const today = new Date().getDay();
    const dayMap: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 1, 0: 5 };
    const dow = dayMap[today] ?? 0;
    const activePeriodIds = new Set(
      schedulePeriods
        .filter((p) => getPeriodStatus(p) === "active" && p.coachName === coachName)
        .map((p) => p.id),
    );
    return schedules.filter(
      (s) => s.coachName === coachName && s.dayOfWeek === dow && activePeriodIds.has(s.periodId),
    );
  }, [coachName]);
  const myAttendance = useMemo(() => {
    const ids = new Set(myAthletes.map((a) => a.id));
    return attendanceRecords.filter((r) => ids.has(r.athleteId));
  }, [myAthletes]);
  const attendancePct = useMemo(() => {
    if (myAttendance.length === 0) return 0;
    const present = myAttendance.filter((r) => r.status === "present").length;
    return Math.round((present / myAttendance.length) * 100);
  }, [myAttendance]);
  const myPlans = useMemo(
    () => plans.filter((p) => p.coachName === coachName).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)),
    [coachName],
  );
  const totalMedals = useMemo(() => {
    return myAthletes.reduce((s, a) => s + a.medals.gold + a.medals.silver + a.medals.bronze, 0);
  }, [myAthletes]);

  const myCompetitions = useMemo(
    () => (user?.id ? competitions.filter((c) => c.coachId === user.id) : []),
    [user?.id],
  );

  const dayLabels: Record<number, string> = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт" };
  const todayLabel = dayLabels[new Date().getDay() === 0 ? 5 : new Date().getDay() === 6 ? 1 : new Date().getDay()] ?? "Пн";

  const centerStats = useMemo(() => {
    return centers.map((c) => {
      const centerCities = athletes
        .filter((a) => getCenterIdByCity(a.city) === c.id)
        .map((a) => a.city);
      const uniqueCities = [...new Set(centerCities)];
      const centerAthletes = athletes.filter((a) => getCenterIdByCity(a.city) === c.id);
      const centerCoachesVal = c.coaches;
      const gold = centerAthletes.reduce((s, a) => s + a.medals.gold, 0);
      const silver = centerAthletes.reduce((s, a) => s + a.medals.silver, 0);
      const bronze = centerAthletes.reduce((s, a) => s + a.medals.bronze, 0);
      return { ...c, cities: uniqueCities, actualGold: gold, actualSilver: silver, actualBronze: bronze };
    });
  }, []);

  const filteredActivity = useMemo(() => {
    if (!selectedCenterId) return recentActivity;
    const centerCities = athletes
      .filter((a) => getCenterIdByCity(a.city) === selectedCenterId)
      .map((a) => a.city);
    const uniqueCities = [...new Set(centerCities)];
    return recentActivity;
  }, [selectedCenterId]);

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
              <Card key={c.id} className="overflow-hidden border-l-4 shadow-[var(--shadow-card)]"
                style={{ borderLeftColor: c.id === "center-1" ? "var(--color-primary)" : c.id === "center-2" ? "var(--color-accent)" : "var(--color-secondary)" }}>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-secondary">{c.name}</h3>
                    <span className="text-xs text-muted-foreground">{c.cities.join(", ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.address}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="text-lg font-bold text-secondary">{c.athletes}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Спортсменов</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="text-lg font-bold text-secondary">{c.coaches}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Тренеров</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="text-lg font-bold text-secondary">{c.groups}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Групп</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                      <div className="text-lg font-bold text-accent">{c.avgEfficiency}%</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Эффективность</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>Медалей: <strong className="text-secondary">{c.actualGold}G / {c.actualSilver}S / {c.actualBronze}B</strong></span>
                    <span>{c.phone}</span>
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
              Сборная держит ритм. <span className="text-accent">+18%</span> медалей к плану.
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              За последние 30 дней проведено 7 сборов и 4 соревнования. Готовность к Кубку России — 92%.
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              Открыть отчёт <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
            <Button variant="outline" className="border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground">
              Календарь
            </Button>
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
            <div className="mt-4 font-display text-2xl font-bold text-secondary">{mySchedulesToday.length}</div>
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
        {kpis.map((k) => (
          <Card key={k.label} className="p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneStyles[k.tone]}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-[color:var(--success)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--success)]">
                {k.delta}
              </span>
            </div>
            <div className="mt-4 font-display text-2xl font-bold text-secondary">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.label}</div>
          </Card>
        ))}
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
                {mySchedulesToday.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Занятий нет</p>
                ) : (
                <ul className="space-y-3">
                  {mySchedulesToday.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-secondary">{s.group}</div>
                        <div className="text-xs text-muted-foreground">{s.timeStart}–{s.timeEnd} · {s.room}</div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">{s.discipline}</div>
                    </li>
                  ))}
                </ul>
                )}
              </Card>

              <Card className="p-5 shadow-[var(--shadow-card)]">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-bold text-secondary">Последний план</h3>
                </div>
                {myPlans.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Нет планов</p>
                ) : (
                  <div>
                    <div className="text-sm font-semibold text-secondary">{myPlans[0].periodLabel}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{myPlans[0].items.length} мероприятий</div>
                    <div className="mt-2">
                      <Badge variant="outline" className={`font-normal ${
                        myPlans[0].status === "approved" ? "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
                        : myPlans[0].status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/30"
                        : myPlans[0].status === "submitted" ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {myPlans[0].status === "approved" ? "Утверждён" : myPlans[0].status === "rejected" ? "Отклонён" : myPlans[0].status === "submitted" ? "На проверке" : "Черновик"}
                      </Badge>
                    </div>
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
              {myCompetitions.filter((c) => c.status === "upcoming").length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Нет предстоящих соревнований</p>
              ) : (
                <ul className="space-y-3">
                  {myCompetitions.filter((c) => c.status === "upcoming").slice(0, 5).map((ev) => (
                    <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-secondary">{ev.title}</div>
                        <div className="text-xs text-muted-foreground">{ev.city} · {ev.date}</div>
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

          {/* Recent activity (coach-filtered) */}
          <section className="mt-6">
            <Card className="p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-secondary">Последние события</h3>
              </div>
              <ul className="space-y-3">
                {recentActivity.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      e.tone === "gold" ? "bg-accent" : e.tone === "warn" ? "bg-destructive" : "bg-primary"
                    }`} />
                    <div className="min-w-0">
                      <span className="font-medium text-secondary">{e.who}</span>{' '}
                      <span className="text-muted-foreground">{e.action}</span>{' '}
                      <span className="font-medium text-foreground">{e.target}</span>
                      <div className="text-xs text-muted-foreground">{e.time}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      ) : (
      <>
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
            <h3 className="font-display text-base font-bold text-secondary">Топ-5 спортсменов по рейтингу</h3>
            <Button variant="ghost" size="sm" className="text-primary">Все <ArrowUpRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <ul className="divide-y divide-border">
            {topAthletes.map((a, i) => (
              <li key={a.id} className="flex items-center gap-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary font-display text-sm font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-secondary">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.discipline} · {a.rank} · {a.city}
                  </div>
                </div>
                <div className="hidden text-xs text-muted-foreground sm:block">{a.coach}</div>
                <div className="font-display text-base font-bold text-primary">{a.rating}</div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-secondary">События</h3>
            </div>
            <ul className="space-y-3">
              {recentActivity.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      e.tone === "gold" ? "bg-accent" : e.tone === "warn" ? "bg-destructive" : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-secondary">{e.who}</span>{" "}
                    <span className="text-muted-foreground">{e.action}</span>{" "}
                    <span className="font-medium text-foreground">{e.target}</span>
                    <div className="text-xs text-muted-foreground">{e.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-secondary">Ближайшие старты</h3>
            </div>
            <ul className="space-y-3">
              {competitions.filter((c) => c.status === "upcoming").slice(0, 3).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-secondary">{ev.title}</div>
                    <div className="text-xs text-muted-foreground">{ev.city} · {ev.athletes.length} от ЦСЕ</div>
                  </div>
                  <div className="shrink-0 rounded-md bg-accent/15 px-2.5 py-1 text-xs font-bold text-secondary">
                    {ev.date}
                  </div>
                </li>
              ))}
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
