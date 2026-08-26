import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Search, Medal, MapPin, CalendarDays, Trophy, X, Users, CalendarIcon, Pencil, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { MiniStat } from "@/components/mini-stat";
import { useAuth, useAuthGuard } from "@/lib/auth";
import {
  competitions, athletes, type Competition, type CompetitionAthlete, type CompetitionResult, type Discipline, type EventLevel, type EventStatus,
  freshCompetitionId, persistCompetitions,
} from "@/lib/mock-data";

export const Route = createFileRoute("/competitions")({
  head: () => ({
    meta: [
      { title: "Соревнования — СОКОЛ" },
      { name: "description", content: "Календарь соревнований и турниров." },
    ],
  }),
  component: CompetitionsPage,
});

const statusFilters = [
  { value: "Все", label: "Все" },
  { value: "upcoming", label: "Предстоящие" },
  { value: "past", label: "Прошедшие" },
  { value: "cancelled", label: "Отменённые" },
] as const;

const levelColor: Record<EventLevel, string> = {
  "Муниципальный": "bg-primary/10 text-primary border-primary/30",
  "Региональный": "bg-secondary/10 text-secondary border-secondary/30",
  "Федеральный": "bg-accent/15 text-accent-foreground border-accent/30",
  "Международный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
};

const resultOrder: CompetitionResult[] = ["1 место", "2 место", "3 место", "5-6 место", "Без места"];

function resultCount(athletes: CompetitionAthlete[], result: CompetitionResult) {
  return athletes.filter((a) => a.result === result).length;
}

function CompetitionsPage() {
  const { loading } = useAuthGuard();
  const { user, isAdmin, isCoach } = useAuth();
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate((n) => n + 1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAthletes, setEditingAthletes] = useState<Competition | null>(null);
  const [editingDetails, setEditingDetails] = useState<Competition | null>(null);

  const coachName = user?.coachName ?? "";
  const coachId = user?.id ?? "";

  const visible = useMemo(() => {
    let list = competitions;
    if (isCoach) list = list.filter((c) => c.coachId === coachId);
    return list;
  }, [isCoach, coachId]);

  const filtered = useMemo(() => {
    return visible.filter((c) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q || c.title.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      const matchS = statusFilter === "Все" || c.status === statusFilter;
      const matchR = resultFilter === "all"
        || (resultFilter === "with_result" && c.athletes.some((a) => a.result && a.result !== "Без места"))
        || (resultFilter === "without_result" && !c.athletes.some((a) => a.result && a.result !== "Без места"));
      return matchQ && matchS && matchR;
    });
  }, [visible, query, statusFilter, resultFilter]);

  const upcoming = useMemo(() => filtered.filter((c) => c.status === "upcoming"), [filtered]);
  const past = useMemo(() => filtered.filter((c) => c.status === "past"), [filtered]);
  const cancelled = useMemo(() => filtered.filter((c) => c.status === "cancelled"), [filtered]);

  const totals = useMemo(() => {
    const totalAthletes = new Set(filtered.flatMap((c) => c.athletes.map((a) => a.athleteId))).size;
    const first = filtered.reduce((s, c) => s + resultCount(c.athletes, "1 место"), 0);
    const withResult = filtered.reduce((s, c) => s + c.athletes.filter((a) => a.result && a.result !== "Без места").length, 0);
    return { total: filtered.length, totalAthletes, first, withResult };
  }, [filtered]);

  const handleCreate = (data: CreateCompetitionData) => {
    const newComp: Competition = {
      id: freshCompetitionId(),
      coachId,
      coachName,
      title: data.title,
      discipline: data.discipline,
      level: data.level,
      date: data.date,
      dateEnd: data.dateEnd || undefined,
      city: data.city,
      location: data.location || undefined,
      status: "upcoming",
      athletes: [],
    };
    competitions.push(newComp);
    persistCompetitions();
    rerender();
    setShowCreateForm(false);
  };

  const handleUpdate = (id: string, data: CreateCompetitionData) => {
    const comp = competitions.find((c) => c.id === id);
    if (!comp) return;
    comp.title = data.title;
    comp.discipline = data.discipline;
    comp.level = data.level;
    comp.date = data.date;
    comp.dateEnd = data.dateEnd || undefined;
    comp.city = data.city;
    comp.location = data.location || undefined;
    if (data.status) comp.status = data.status;
    persistCompetitions();
    rerender();
    setEditingDetails(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Удалить соревнование?")) return;
    const idx = competitions.findIndex((c) => c.id === id);
    if (idx !== -1) competitions.splice(idx, 1);
    persistCompetitions();
    rerender();
  };

  const handleCancel = (id: string) => {
    if (!confirm("Отменить соревнование?")) return;
    const comp = competitions.find((c) => c.id === id);
    if (comp) comp.status = "cancelled";
    persistCompetitions();
    rerender();
  };

  const handleAddAthlete = (comp: Competition, athleteId: string, athleteName: string) => {
    if (comp.athletes.some((a) => a.athleteId === athleteId)) return;
    comp.athletes.push({ athleteId, athleteName });
    persistCompetitions();
    rerender();
  };

  const handleRemoveAthlete = (comp: Competition, athleteId: string) => {
    comp.athletes = comp.athletes.filter((a) => a.athleteId !== athleteId);
    persistCompetitions();
    rerender();
  };

  const handleSetResult = (comp: Competition, athleteId: string, result: CompetitionResult | undefined) => {
    const found = comp.athletes.find((a) => a.athleteId === athleteId);
    if (found) found.result = result;
    persistCompetitions();
    rerender();
  };

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
            {upcoming.length} предстоящих · {past.length} прошедших · {totals.totalAthletes} участников от ЦСЕ
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Добавить соревнование
          </Button>
        </div>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Всего в календаре" value={totals.total.toString()} accent="primary" icon={<Trophy className="h-4 w-4" />} />
        <MiniStat label="Участников от ЦСЕ" value={totals.totalAthletes.toString()} accent="accent" icon={<Users className="h-4 w-4" />} />
        <MiniStat label="Победителей (1 место)" value={totals.first.toString()} accent="success" icon={<Medal className="h-4 w-4" />} />
        <MiniStat label="Всего с местами" value={totals.withResult.toString()} accent="secondary" icon={<Medal className="h-4 w-4" />} />
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
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    statusFilter === s.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {[
                { value: "all", label: "Все" },
                { value: "with_result", label: "С результатом" },
                { value: "without_result", label: "Без результата" },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setResultFilter(r.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    resultFilter === r.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
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
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onEditAthletes={isCoach ? () => setEditingAthletes(ev) : undefined}
                    onEditDetails={isCoach ? () => setEditingDetails(ev) : undefined}
                    onDelete={isCoach ? () => handleDelete(ev.id) : undefined}
                    onCancel={isCoach && ev.status !== "cancelled" ? () => handleCancel(ev.id) : undefined}
                  />
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
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onEditAthletes={isCoach ? () => setEditingAthletes(ev) : undefined}
                    onEditDetails={isCoach ? () => setEditingDetails(ev) : undefined}
                    onDelete={isCoach ? () => handleDelete(ev.id) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {cancelled.length > 0 && (
            <div className="p-4">
              <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-destructive">
                Отменённые ({cancelled.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cancelled.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onEditAthletes={isCoach ? () => setEditingAthletes(ev) : undefined}
                    onEditDetails={isCoach ? () => setEditingDetails(ev) : undefined}
                    onDelete={isCoach ? () => handleDelete(ev.id) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {showCreateForm && (
        <CompetitionFormModal
          defaultDiscipline={(user?.coachDiscipline ?? "Бокс") as Discipline}
          onSave={handleCreate}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {editingDetails && (
        <CompetitionFormModal
          competition={editingDetails}
          onSave={(data) => handleUpdate(editingDetails.id, data)}
          onClose={() => setEditingDetails(null)}
        />
      )}

      {editingAthletes && (
        <ManageAthletesModal
          competition={editingAthletes}
          coachId={coachId}
          onAddAthlete={handleAddAthlete}
          onRemoveAthlete={handleRemoveAthlete}
          onSetResult={handleSetResult}
          onClose={() => setEditingAthletes(null)}
        />
      )}
    </AppShell>
  );
}

function EventCard({ event, onEditAthletes, onEditDetails, onDelete, onCancel }: {
  event: Competition;
  onEditAthletes?: () => void;
  onEditDetails?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const athleteCount = event.athletes.length;
  const first = resultCount(event.athletes, "1 место");
  const second = resultCount(event.athletes, "2 место");
  const third = resultCount(event.athletes, "3 место");
  const places56 = resultCount(event.athletes, "5-6 место");
  const noResult = resultCount(event.athletes, "Без места");
  const hasResults = first > 0 || second > 0 || third > 0 || places56 > 0;

  return (
    <Card className={`group border-border p-4 shadow-[var(--shadow-card)] transition hover:shadow-md ${
      event.status === "cancelled" ? "opacity-60 hover:opacity-80" : "hover:border-primary/30"
    }`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate font-display text-sm font-bold text-secondary">
              {event.title}
            </div>
            {event.status === "cancelled" && (
              <Badge variant="outline" className="shrink-0 border-destructive/30 bg-destructive/10 font-normal text-destructive">
                Отменено
              </Badge>
            )}
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
          {athleteCount} участников
        </span>
      </div>

      {hasResults && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs">
          <span className="font-medium text-muted-foreground">Результаты ЦСЕ:</span>
          {first > 0 && <ResultBadge label="1 место" count={first} />}
          {second > 0 && <ResultBadge label="2 место" count={second} />}
          {third > 0 && <ResultBadge label="3 место" count={third} />}
          {places56 > 0 && <ResultBadge label="5-6 место" count={places56} />}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
        {onEditAthletes && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEditAthletes}>
            {event.status === "past" ? <Medal className="mr-1 h-3 w-3" /> : <Users className="mr-1 h-3 w-3" />}
            {event.status === "past" ? "Результаты" : "Участники"}
          </Button>
        )}
        {onEditDetails && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEditDetails}>
            <Pencil className="mr-1 h-3 w-3" /> Редактировать
          </Button>
        )}
        {onCancel && event.status === "upcoming" && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={onCancel}>
            <X className="mr-1 h-3 w-3" /> Отменить
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1 h-3 w-3" /> Удалить
          </Button>
        )}
      </div>
    </Card>
  );
}

function ResultBadge({ label, count }: { label: string; count: number }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-xs">
      {label}: {count}
    </span>
  );
}

/* ───── Create Competition Modal ───── */

interface CreateCompetitionData {
  title: string;
  discipline: Discipline;
  level: EventLevel;
  date: string;
  dateEnd?: string;
  city: string;
  location?: string;
  status?: EventStatus;
}

function parseDate(str: string): Date | undefined {
  if (!str) return undefined;
  const parts = str.split(".");
  if (parts.length === 3) {
    const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    if (!isNaN(d.getTime())) return d;
  }
  const ruMonths: Record<string, number> = {
    "января": 0, "февраля": 1, "марта": 2, "апреля": 3, "мая": 4, "июня": 5,
    "июля": 6, "августа": 7, "сентября": 8, "октября": 9, "ноября": 10, "декабря": 11,
  };
  const match = str.match(/^(\d+)\s+([а-я]+)\s+(\d{4})$/);
  if (match) {
    const month = ruMonths[match[2].toLowerCase()];
    if (month !== undefined) {
      const d = new Date(+match[3], month, +match[1]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return undefined;
}

function CompetitionFormModal({ defaultDiscipline, competition, onSave, onClose }: {
  defaultDiscipline?: Discipline;
  competition?: Competition;
  onSave: (data: CreateCompetitionData) => void;
  onClose: () => void;
}) {
  const isEdit = !!competition;
  const [title, setTitle] = useState(competition?.title ?? "");
  const [discipline, setDiscipline] = useState<Discipline>(competition?.discipline ?? defaultDiscipline ?? "Бокс");
  const [level, setLevel] = useState<EventLevel>(competition?.level ?? "Муниципальный");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(competition ? parseDate(competition.date) : undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(competition?.dateEnd ? parseDate(competition.dateEnd) : undefined);
  const [city, setCity] = useState(competition?.city ?? "");
  const [location, setLocation] = useState(competition?.location ?? "");

  const dateStr = selectedDate ? format(selectedDate, "dd.MM.yyyy") : "";
  const dateEndStr = selectedEndDate ? format(selectedEndDate, "dd.MM.yyyy") : "";
  const canSave = title.trim() && !!selectedDate && city.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-display text-lg font-bold text-secondary">{isEdit ? "Редактировать соревнование" : "Новое соревнование"}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Название *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Кубок города по дзюдо" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
              <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {(["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"] as Discipline[]).map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Уровень *</label>
              <select value={level} onChange={(e) => setLevel(e.target.value as EventLevel)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {(["Муниципальный", "Региональный", "Федеральный", "Международный"] as EventLevel[]).map((l) => (<option key={l} value={l}>{l}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата начала</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateStr || <span className="text-muted-foreground">Выберите дату</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" locale={ru} selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата окончания</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateEndStr || <span className="text-muted-foreground">Выберите дату</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" locale={ru} selected={selectedEndDate} onSelect={setSelectedEndDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Город *</label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" className="h-9" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Место проведения</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ЦСЕ «Сокол», спорткомплекс…" className="h-9" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>Отмена</Button>
          <Button size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90" disabled={!canSave} onClick={() => canSave && onSave({ title, discipline, level, date: dateStr, dateEnd: dateEndStr || undefined, city, location })}>
            {isEdit ? "Сохранить" : <><Plus className="mr-1 h-3 w-3" /> Добавить</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───── Manage Athletes Modal ───── */

function ManageAthletesModal({
  competition, coachId, onAddAthlete, onRemoveAthlete, onSetResult, onClose,
}: {
  competition: Competition;
  coachId: string;
  onAddAthlete: (comp: Competition, athleteId: string, athleteName: string) => void;
  onRemoveAthlete: (comp: Competition, athleteId: string) => void;
  onSetResult: (comp: Competition, athleteId: string, result: CompetitionResult | undefined) => void;
  onClose: () => void;
}) {
  const [athleteSearch, setAthleteSearch] = useState("");

  const coachAthletes = useMemo(() => {
    const coachLastName = competition.coachName.split(" ")[0];
    return athletes.filter((a) => a.coach.toLowerCase().includes(coachLastName.toLowerCase()));
  }, [competition.coachName]);

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return coachAthletes;
    return coachAthletes.filter((a) => a.name.toLowerCase().includes(q));
  }, [coachAthletes, athleteSearch]);

  const selectedIds = new Set(competition.athletes.map((a) => a.athleteId));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">{competition.title}</h3>
            <p className="text-sm text-muted-foreground">{competition.city} · {competition.date}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="px-6 py-4">
          {/* Athlete search */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              placeholder="Поиск спортсмена…"
              className="h-9 pl-9"
            />
          </div>

          {/* Selected athletes */}
          {competition.athletes.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Участники ({competition.athletes.length})</h4>
              <div className="space-y-2">
                {competition.athletes.map((ath) => (
                  <div key={ath.athleteId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-sm font-medium text-secondary">{ath.athleteName}</span>
                    <div className="flex items-center gap-1.5">
                      {competition.status === "past" && (
                        <div className="flex flex-wrap gap-1">
                          {resultOrder.map((r) => (
                            <button
                              key={r}
                              onClick={() => onSetResult(competition, ath.athleteId, ath.result === r ? undefined : r)}
                              className={`rounded px-2 py-1 text-xs font-semibold transition ${
                                ath.result === r
                                  ? "bg-accent text-accent-foreground"
                                  : r === "Без места"
                                    ? "bg-muted text-muted-foreground hover:bg-destructive/10"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={() => onRemoveAthlete(competition, ath.athleteId)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available athletes */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Спортсмены тренера</h4>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {filteredAthletes.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">Спортсмены не найдены</p>
              )}
              {filteredAthletes.map((a) => {
                const isSelected = selectedIds.has(a.id);
                return (
                  <div key={a.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 transition ${
                    isSelected ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/30"
                  }`}>
                    <div>
                      <span className="text-sm font-medium text-secondary">{a.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{a.rank} · {a.discipline}</span>
                    </div>
                    {!isSelected && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => onAddAthlete(competition, a.id, a.name)}>
                        <Plus className="mr-0.5 h-3 w-3" /> Добавить
                      </Button>
                    )}
                    {isSelected && (
                      <span className="text-xs text-primary">Добавлен</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>Готово</Button>
        </div>
      </div>
    </div>
  );
}
