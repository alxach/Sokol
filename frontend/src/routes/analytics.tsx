import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, Area, AreaChart, PieChart, Pie, Cell,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  TrendingUp, Users, UserCog, Trophy, Activity,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import {
  fetchAnalyticsSummary,
  type AnalyticsSummaryDto,
} from "@/lib/api/analytics.functions";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Аналитика — СОКОЛ" },
      { name: "description", content: "Детальная аналитика по всем направлениям." },
    ],
  }),
  component: AnalyticsPage,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const toneStyles: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent-foreground",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
};

function AnalyticsPage() {
  const { loading } = useAuthGuard();
  const { isAdmin, isDirector } = useAuth();
  const [data, setData] = useState<AnalyticsSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchAnalyticsSummary()
      .then((summary) => {
        if (mounted) {
          setData(summary);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить аналитику");
        }
      })
      .finally(() => {
        if (mounted) setLoadingData(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!isAdmin && !isDirector) {
    return (
      <AppShell title="Аналитика" subtitle="Детальная статистика и метрики">
        <Card className="border-border p-8 text-center text-muted-foreground shadow-[var(--shadow-card)]">
          Аналитика доступна администратору и директору.
        </Card>
      </AppShell>
    );
  }

  const totalMedals = data
    ? data.kpis.medals.gold + data.kpis.medals.silver + data.kpis.medals.bronze
    : 0;

  const kpis = data
    ? [
        { label: "Спортсменов", value: data.kpis.athletes, icon: Users, tone: "primary" as const },
        { label: "Тренеров", value: data.kpis.coaches, icon: UserCog, tone: "accent" as const },
        { label: "Соревнований", value: data.kpis.competitions, icon: Trophy, tone: "secondary" as const },
        { label: "Всего медалей", value: totalMedals, icon: TrendingUp, tone: "success" as const },
      ]
    : [];

  return (
    <AppShell title="Аналитика" subtitle="Детальная статистика и метрики">
      {loadingData && (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
          Загрузка аналитики…
        </div>
      )}

      {error && (
        <Card className="border-border p-8 text-center text-destructive shadow-[var(--shadow-card)]">
          {error}
        </Card>
      )}

      {data && !loadingData && (
        <>
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
              {data.athletes_by_status.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Нет данных о спортсменах</p>
              ) : (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.athletes_by_status}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={96}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.athletes_by_status.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {data.athletes_by_status.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="font-bold text-secondary">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Athletes by Discipline */}
            <Card className="border-border p-5 shadow-[var(--shadow-card)]">
              <h3 className="mb-4 font-display text-base font-bold text-secondary">Спортсмены по дисциплинам</h3>
              {data.athletes_by_discipline.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Нет данных о дисциплинах</p>
              ) : (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.athletes_by_discipline}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={96}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.athletes_by_discipline.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {data.athletes_by_discipline.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-bold text-secondary">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="mb-6 grid gap-6 md:grid-cols-2">
            {/* Monthly medals */}
            <Card className="border-border p-5 shadow-[var(--shadow-card)]">
              <h3 className="mb-4 font-display text-base font-bold text-secondary">Медальная динамика (12 месяцев)</h3>
              {data.medal_dynamics.every((m) => m.gold === 0 && m.silver === 0 && m.bronze === 0) ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Пока нет медалей</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.medal_dynamics}>
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
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="gold" stroke="#F4A838" fill="url(#gold)" strokeWidth={2} name="Золото" />
                    <Area type="monotone" dataKey="silver" stroke="#94A3B8" fill="url(#silver)" strokeWidth={2} name="Серебро" />
                    <Area type="monotone" dataKey="bronze" stroke="#CD7F32" fill="url(#bronze)" strokeWidth={2} name="Бронза" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Coach workload */}
            <Card className="border-border p-5 shadow-[var(--shadow-card)]">
              <h3 className="mb-4 font-display text-base font-bold text-secondary">Нагрузка на тренеров</h3>
              {data.coach_workload.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Нет привязанных тренеров</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.coach_workload}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="athletes" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Спортсменов" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Top Athletes */}
          <Card className="border-border shadow-[var(--shadow-card)]">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-display text-base font-bold text-secondary">Топ спортсменов по медалям</h3>
            </div>
            {data.top_athletes.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Activity className="h-5 w-5" />
                Нет спортсменов с медалями
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-medium">#</th>
                      <th className="px-5 py-3 font-medium">Спортсмен</th>
                      <th className="px-5 py-3 font-medium">Дисциплина</th>
                      <th className="px-5 py-3 font-medium">Разряд</th>
                      <th className="px-5 py-3 font-medium">Очки</th>
                      <th className="px-5 py-3 font-medium">Медали</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.top_athletes.map((a, i) => (
                      <tr key={a.name + i} className="transition hover:bg-muted/30">
                        <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-secondary">{a.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">{a.discipline || "—"}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                            {a.rank || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-bold text-secondary">{a.points}</span>
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
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}