import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search, TrendingUp, Users, UsersRound, Dumbbell } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { coaches, type Discipline } from "@/lib/mock-data";

export const Route = createFileRoute("/coaches")({
  head: () => ({
    meta: [
      { title: "Тренеры — СОКОЛ" },
      { name: "description", content: "Управление тренерским составом: профили, нагрузка, KPI." },
    ],
  }),
  component: CoachesPage,
});

const disciplines: ("Все" | Discipline)[] = ["Все", "Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];

const statusStyle: Record<string, string> = {
  "Активный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  "Отпуск": "bg-primary/10 text-primary border-primary/30",
  "На больничном": "bg-destructive/10 text-destructive border-destructive/30",
};

const workloadColor = (w: number) => {
  if (w >= 85) return "text-[color:var(--success)]";
  if (w >= 65) return "text-primary";
  return "text-destructive";
};

function CoachesPage() {
  const { loading } = useAuthGuard();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<(typeof disciplines)[number]>("Все");

  const filtered = useMemo(() => {
    return coaches.filter((c) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q);
      const matchD = discipline === "Все" || c.disciplines.includes(discipline);
      return matchQ && matchD;
    });
  }, [query, discipline]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => c.status === "Активный").length;
    const sumAthletes = filtered.reduce((s, c) => s + c.athletes, 0);
    const avgEfficiency = total ? Math.round(filtered.reduce((s, c) => s + c.efficiency, 0) / total) : 0;
    return { total, active, sumAthletes, avgEfficiency };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Тренеры" subtitle="Управление тренерским составом">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Тренерский состав</h2>
          <p className="text-sm text-muted-foreground">
            {totals.total} в выборке · {totals.active} активных · {totals.sumAthletes} спортсменов
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" /> Фильтры
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Добавить
            </Button>
          </div>
        )}
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Всего в выборке" value={totals.total.toString()} accent="primary" icon={<UsersRound className="h-4 w-4" />} />
        <MiniStat label="Активных" value={totals.active.toString()} accent="success" icon={<Users className="h-4 w-4" />} />
        <MiniStat label="Спортсменов на нагрузке" value={totals.sumAthletes.toString()} accent="accent" icon={<Dumbbell className="h-4 w-4" />} />
        <MiniStat label="Средняя эффективность" value={`${totals.avgEfficiency}%`} accent="secondary" icon={<TrendingUp className="h-4 w-4" />} />
      </section>

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени, ID, городу…"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {disciplines.map((d) => (
              <button
                key={d}
                onClick={() => setDiscipline(d)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  discipline === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[110px]">ID</TableHead>
                <TableHead>Тренер</TableHead>
                <TableHead>Дисциплины</TableHead>
                <TableHead className="text-center">Групп</TableHead>
                <TableHead className="text-center">Спортсменов</TableHead>
                <TableHead className="text-center">Нагрузка</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Эффективность</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-xs font-bold text-primary-foreground">
                        {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-secondary">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.city} · {c.experience} лет стажа</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.disciplines.map((d) => (
                        <Badge key={d} variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium text-secondary">{c.groups}</TableCell>
                  <TableCell className="text-center font-medium text-secondary">{c.athletes}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${c.workload}%`,
                            background: c.workload >= 85 ? "var(--success)" : c.workload >= 65 ? "var(--color-primary)" : "var(--color-destructive)",
                          }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${workloadColor(c.workload)}`}>
                        {c.workload}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-normal ${statusStyle[c.status]}`}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-display font-bold text-primary">
                    {c.efficiency}%
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    Ничего не найдено по выбранным фильтрам.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: "primary" | "secondary" | "accent" | "success";
  icon?: React.ReactNode;
}) {
  const tone: Record<typeof accent, string> = {
    primary: "border-l-primary",
    secondary: "border-l-secondary",
    accent: "border-l-accent",
    success: "border-l-[color:var(--success)]",
  };
  return (
    <Card className={`flex items-center justify-between border-l-4 p-5 shadow-[var(--shadow-card)] ${tone[accent]}`}>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-2xl font-bold text-secondary">{value}</div>
      </div>
      {icon && <div className="text-accent">{icon}</div>}
    </Card>
  );
}
