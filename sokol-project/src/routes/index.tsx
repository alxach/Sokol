import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuthGuard } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  athletes,
  disciplineMix,
  monthlyResults,
  recentActivity,
  competitions,
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
  const topAthletes = [...athletes].sort((a, b) => b.rating - a.rating).slice(0, 5);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Дашборд" subtitle="Оперативная сводка по сборной">
      {/* Hero banner */}
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

      {/* KPIs */}
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
              {competitions.filter((c) => c.status === "Предстоящее").slice(0, 3).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-secondary">{ev.title}</div>
                    <div className="text-xs text-muted-foreground">{ev.city} · {ev.participantsCse} от ЦСЕ</div>
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
