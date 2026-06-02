import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search, Medal, Pencil, Trash2, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  athletes,
  type AthleteStatus,
  type Discipline,
  type Athlete,
} from "@/lib/mock-data";

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
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);

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
          <Button variant="outline" disabled>
            <Filter className="mr-2 h-4 w-4" /> Фильтры
          </Button>
          <Button onClick={() => { setEditing(null); setShowModal(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                <TableHead className="w-[80px] text-right">Действия</TableHead>
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setEditing(a); setShowModal(true); }}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Удалить ${a.name}?`)) {
                            const idx = athletes.findIndex((x) => x.id === a.id);
                            if (idx !== -1) athletes.splice(idx, 1);
                            setQuery((q) => q + " ");
                            setTimeout(() => setQuery((q) => q.trim()), 0);
                          }
                        }}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    Ничего не найдено по выбранным фильтрам.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {showModal && (
        <AthleteModal
          athlete={editing}
          coachName={isCoach ? user?.coachName ?? "" : undefined}
          coachDiscipline={isCoach ? user?.coachDiscipline : undefined}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => {
            setShowModal(false);
            setEditing(null);
            setQuery((q) => q + " ");
            setTimeout(() => setQuery((q) => q.trim()), 0);
          }}
        />
      )}
    </AppShell>
  );
}

const rankOptions = ["КМС", "МС", "МСМК", "ЗМС", "1-й разряд", "2-й разряд", "3-й разряд"];
const statusOptions: AthleteStatus[] = ["Активный", "Сборы", "Травма", "Резерв"];

function AthleteModal({
  athlete,
  coachName,
  coachDiscipline,
  onClose,
  onSaved,
}: {
  athlete: Athlete | null;
  coachName?: string;
  coachDiscipline?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!athlete;
  const [name, setName] = useState(athlete?.name ?? "");
  const [discipline, setDiscipline] = useState<Discipline>((athlete?.discipline ?? coachDiscipline ?? "Дзюдо") as Discipline);
  const [rank, setRank] = useState(athlete?.rank ?? "КМС");
  const [age, setAge] = useState(String(athlete?.age ?? ""));
  const [city, setCity] = useState(athlete?.city ?? "");
  const [status, setStatus] = useState<AthleteStatus>(athlete?.status ?? "Активный");
  const [coach, setCoach] = useState(athlete?.coach ?? coachName ?? "");

  const handleSave = () => {
    if (!name.trim()) return;
    if (isEdit) {
      Object.assign(athlete, {
        name: name.trim(),
        discipline,
        rank,
        age: Number(age) || 0,
        city: city.trim(),
        status,
        coach: coach.trim(),
      });
    } else {
      const lastId = athletes
        .map((a) => Number(a.id.replace("SK-", "")))
        .reduce((max, n) => Math.max(max, n), 0);
      athletes.push({
        id: `SK-${String(lastId + 1).padStart(4, "0")}`,
        name: name.trim(),
        discipline,
        rank: rank || "КМС",
        age: Number(age) || 0,
        city: city.trim() || "Не указано",
        coach: coach.trim(),
        status,
        medals: { gold: 0, silver: 0, bronze: 0 },
        rating: 1000,
        lastEvent: "—",
      });
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">{isEdit ? "Редактировать" : "Новый"} спортсмен</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as Discipline)}
                  disabled={!!coachDiscipline}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                >
                {disciplines.filter((d) => d !== "Все").map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Разряд</label>
              <select
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {rankOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Возраст</label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Город</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AthleteStatus)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Тренер</label>
              <Input
                value={coach}
                onChange={(e) => setCoach(e.target.value)}
                placeholder="Фамилия И.О."
                className="h-9"
                disabled={!!coachName}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="outline" className="flex-1">Отмена</Button>
            <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
              {isEdit ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
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
