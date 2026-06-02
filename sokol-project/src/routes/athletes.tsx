import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search, Medal } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuthGuard, useAuth } from "@/lib/auth";
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
import { athletes, type AthleteStatus, type Discipline } from "@/lib/mock-data";

export const Route = createFileRoute("/athletes")({
  head: () => ({
    meta: [
      { title: "Спортсмены — СОКОЛ" },
      { name: "description", content: "CRM спортсменов: карточки, дисциплины, рейтинг, медали." },
    ],
  }),
  component: AthletesPage,
});

const disciplines: ("Все" | Discipline)[] = ["Все", "Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];

const statusStyle: Record<AthleteStatus, string> = {
  "Активный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  "Сборы": "bg-primary/10 text-primary border-primary/30",
  "Травма": "bg-destructive/10 text-destructive border-destructive/30",
  "Резерв": "bg-muted text-muted-foreground border-border",
};

function AthletesPage() {
  const { loading, user } = useAuthGuard();
  const { isCoach } = useAuth();
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<(typeof disciplines)[number]>("Все");

  const accessible = useMemo(() => {
    return isCoach && user?.coachName
      ? athletes.filter((a) => a.coach === user.coachName)
      : athletes;
  }, [isCoach, user]);

  const filtered = useMemo(() => {
    return accessible.filter((a) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q);
      const matchD = discipline === "Все" || a.discipline === discipline;
      return matchQ && matchD;
    });
  }, [query, discipline, accessible]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((a) => a.status === "Активный").length;
    const gold = filtered.reduce((s, a) => s + a.medals.gold, 0);
    const avg = total ? Math.round(filtered.reduce((s, a) => s + a.rating, 0) / total) : 0;
    return { total, active, gold, avg };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Спортсмены" subtitle="CRM сборной команды">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Реестр спортсменов</h2>
          <p className="text-sm text-muted-foreground">
            {totals.total} в выборке · {totals.active} активных · средний рейтинг {totals.avg}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" /> Фильтры
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>

      {/* Mini KPIs */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Всего в выборке" value={totals.total.toString()} accent="primary" />
        <MiniStat label="Активные" value={totals.active.toString()} accent="success" />
        <MiniStat label="Золотых медалей" value={totals.gold.toString()} accent="accent" icon={<Medal className="h-4 w-4" />} />
        <MiniStat label="Средний рейтинг" value={totals.avg.toLocaleString("ru-RU")} accent="secondary" />
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
                <TableHead>Спортсмен</TableHead>
                <TableHead>Дисциплина</TableHead>
                <TableHead>Разряд</TableHead>
                <TableHead>Тренер</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-center">Медали (З/С/Б)</TableHead>
                <TableHead className="text-right">Рейтинг</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-secondary">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.city} · {a.age} лет</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                      {a.discipline}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-secondary">{a.rank}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.coach}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-normal ${statusStyle[a.status]}`}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-secondary">{a.medals.gold}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{a.medals.silver}</span>
                      <span className="rounded bg-[oklch(0.65_0.12_50)]/15 px-1.5 py-0.5 text-[oklch(0.5_0.12_50)]">{a.medals.bronze}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-display font-bold text-primary">
                    {a.rating.toLocaleString("ru-RU")}
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
