import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search, Medal, MapPin, CalendarDays, Trophy } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  competitions, type Competition, type Discipline, type EventLevel,
} from "@/lib/mock-data";

export const Route = createFileRoute("/competitions")({
  head: () => ({
    meta: [
      { title: "Соревнования — СОКОЛ" },
      { name: "description", content: "Календарь соревнований и турниров: заявки, результаты, протоколы." },
    ],
  }),
  component: CompetitionsPage,
});

const disciplines: ("Все" | Discipline)[] = ["Все", "Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];
const statusFilters = ["Все", "Предстоящее", "Прошедшее"] as const;

const levelColor: Record<EventLevel, string> = {
  "Муниципальный": "bg-primary/10 text-primary border-primary/30",
  "Региональный": "bg-secondary/10 text-secondary border-secondary/30",
  "Федеральный": "bg-accent/15 text-accent-foreground border-accent/30",
  "Международный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
};

function CompetitionsPage() {
  const { loading } = useAuthGuard();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<(typeof disciplines)[number]>("Все");
  const [statusFilter, setStatusFilter] = useState<string>("Все");

  const filtered = useMemo(() => {
    return competitions.filter((c) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q || c.title.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      const matchD = discipline === "Все" || c.discipline === discipline;
      const matchS = statusFilter === "Все" || c.status === statusFilter;
      return matchQ && matchD && matchS;
    });
  }, [query, discipline, statusFilter]);

  const upcoming = useMemo(() => filtered.filter((c) => c.status === "Предстоящее"), [filtered]);
  const past = useMemo(() => filtered.filter((c) => c.status === "Прошедшее"), [filtered]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const totalParticipants = filtered.reduce((s, c) => s + c.participantsCse, 0);
    const gold = filtered.reduce((s, c) => s + (c.medals?.gold ?? 0), 0);
    const totalMedals = filtered.reduce((s, c) => s + (c.medals ? c.medals.gold + c.medals.silver + c.medals.bronze : 0), 0);
    return { total, totalParticipants, gold, totalMedals };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Соревнования" subtitle="Календарь соревнований и турниров">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Календарь соревнований</h2>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} предстоящих · {past.length} прошедших · {totals.totalParticipants} участников от ЦСЕ
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
        <MiniStat label="Всего в календаре" value={totals.total.toString()} accent="primary" icon={<Trophy className="h-4 w-4" />} />
        <MiniStat label="Участников от ЦСЕ" value={totals.totalParticipants.toString()} accent="accent" icon={<MapPin className="h-4 w-4" />} />
        <MiniStat label="Золотых медалей" value={totals.gold.toString()} accent="success" icon={<Medal className="h-4 w-4" />} />
        <MiniStat label="Всего медалей" value={totals.totalMedals.toString()} accent="secondary" icon={<Medal className="h-4 w-4" />} />
      </section>

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию, городу…"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <div className="flex gap-1 border-r border-border pr-2">
              {statusFilters.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    statusFilter === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
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

        <div className="divide-y divide-border">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Ничего не найдено по выбранным фильтрам.
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="p-4">
              <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-primary">
                Предстоящие ({upcoming.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="p-4">
              <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Прошедшие ({past.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </AppShell>
  );
}

function EventCard({ event }: { event: Competition }) {
  return (
    <Card className="group border-border p-4 shadow-[var(--shadow-card)] transition hover:border-primary/30 hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-bold text-secondary">
            {event.title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {event.city}
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 font-normal ${levelColor[event.level]}`}>
          {event.level}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {event.date}{event.dateEnd ? ` – ${event.dateEnd}` : ""}
        </span>
        <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
          {event.discipline}
        </Badge>
        <span className="text-muted-foreground">
          {event.participantsCse} / {event.participants} уч.
        </span>
      </div>

      {event.medals && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs">
          <span className="font-medium text-muted-foreground">Медали ЦСЕ:</span>
          <span className="flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 font-semibold text-secondary">
            🥇 {event.medals.gold}
          </span>
          <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
            🥈 {event.medals.silver}
          </span>
          <span className="flex items-center gap-1 rounded bg-[oklch(0.65_0.12_50)]/15 px-1.5 py-0.5 font-semibold text-[oklch(0.5_0.12_50)]">
            🥉 {event.medals.bronze}
          </span>
        </div>
      )}
    </Card>
  );
}

function MiniStat({
  label, value, accent, icon,
}: {
  label: string; value: string; accent: "primary" | "secondary" | "accent" | "success"; icon?: React.ReactNode;
}) {
  const tone: Record<string, string> = {
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
