import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart, Bar, Area, AreaChart, PieChart, Pie, Cell,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  TrendingUp, Users, UserCog, Trophy, Activity,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuthGuard } from "@/lib/auth";
import {
  athletes, coaches, monthlyResults, disciplineMix, competitions,
} from "@/lib/mock-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Аналитика — СОКОЛ" },
      { name: "description", content: "Детальная аналитика по всем направлениям." },
    ],
  }),
  component: AnalyticsPage,
});

const disciplines = ["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"] as const;

function AnalyticsPage() {
  const { loading } = useAuthGuard();

  const athletesByDiscipline = disciplines.map((d) => ({
    name: d,
    value: athletes.filter((a) => a.discipline === d).length,
  }));

  const athletesByStatus = [
    { name: "Активные", value: athletes.filter((a) => a.status === "Активный").length },
    { name: "Травма", value: athletes.filter((a) => a.status === "Травма").length },

    { name: "Резерв", value: athletes.filter((a) => a.status === "Резерв").length },
  ];

  const coachWorkload = coaches.map((c) => ({
    name: c.name.split(" ")[0],
    athletes: athletes.filter((a) => a.coach === c.name).length,
  }));

  const totalGold = monthlyResults.reduce((s, m) => s + m.gold, 0);
  const totalSilver = monthlyResults.reduce((s, m) => s + m.silver, 0);
  const totalBronze = monthlyResults.reduce((s, m) => s + m.bronze, 0);

  const kpis = [
    { label: "Спортсменов", value: athletes.length, icon: Users, tone: "primary" as const },
    { label: "Тренеров", value: coaches.length, icon: UserCog, tone: "accent" as const },
    { label: "Соревнований", value: competitions.length, icon: Trophy, tone: "secondary" as const },
    { label: "Всего медалей", value: totalGold + totalSilver + totalBronze, icon: TrendingUp, tone: "success" as const },
  ];

  const toneStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent-foreground",
    secondary: "bg-secondary/10 text-secondary",
    success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  };

  const CHART_COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Аналитика" subtitle="Детальная статистика и метрики">
      {/* KPI */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="flex items-center gap-4 border-border p-5 shadow-[var(--shadow-card)]">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneStyles[kpi.tone]}`}>
              <kpi.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="font-display text-2xl font-bold text-secondary">{kpi.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {/* Athletes by Status */}
        <Card className="border-border p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 font-display text-base font-bold text-secondary">Распределение спортсменов по статусам</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={athletesByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={96}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {athletesByStatus.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {athletesByStatus.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-bold text-secondary">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Athletes by Discipline */}
        <Card className="border-border p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 font-display text-base font-bold text-secondary">Спортсмены по дисциплинам</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={athletesByDiscipline}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={96}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {athletesByDiscipline.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {athletesByDiscipline.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-bold text-secondary">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {/* Monthly medals */}
        <Card className="border-border p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 font-display text-base font-bold text-secondary">Медальная динамика (сезон)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyResults}>
              <defs>
                <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F4A838" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F4A838" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bronze" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CD7F32" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#CD7F32" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip />
              <Area type="monotone" dataKey="gold" stroke="#F4A838" fill="url(#gold)" strokeWidth={2} name="Золото" />
              <Area type="monotone" dataKey="silver" stroke="#94A3B8" fill="url(#silver)" strokeWidth={2} name="Серебро" />
              <Area type="monotone" dataKey="bronze" stroke="#CD7F32" fill="url(#bronze)" strokeWidth={2} name="Бронза" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Coach workload */}
        <Card className="border-border p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 font-display text-base font-bold text-secondary">Нагрузка на тренеров</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={coachWorkload}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="athletes" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Спортсменов" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Athletes */}
      <Card className="border-border shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-display text-base font-bold text-secondary">Топ спортсменов по рейтингу</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Спортсмен</th>
                <th className="px-5 py-3 font-medium">Дисциплина</th>
                <th className="px-5 py-3 font-medium">Разряд</th>
                <th className="px-5 py-3 font-medium">Рейтинг</th>
                <th className="px-5 py-3 font-medium">Медали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...athletes]
                .sort((a, b) => b.rating - a.rating)
                .map((a, i) => (
                  <tr key={a.id} className="transition hover:bg-muted/30">
                    <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-secondary">{a.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.discipline}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                        {a.rank}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-bold text-secondary">{a.rating}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#F4A838] font-bold">{a.medals.gold}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-[#94A3B8]">{a.medals.silver}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-[#CD7F32]">{a.medals.bronze}</span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
