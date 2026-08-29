import { useCallback, useEffect, useMemo, useState } from "react";
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
  fetchCompetitions, createCompetition, updateCompetition, deleteCompetitionEvent,
  cancelCompetition, addCompetitionParticipant, removeCompetitionParticipant,
  setCompetitionResult, clearCompetitionResult, isoDate, parseDate,
  type CompetitionDto, type CompetitionParticipantDto, type CompetitionChildDto,
} from "@/lib/api/events.functions";
import { fetchAthletes, athleteFullName, type AthleteDto } from "@/lib/api/athletes.functions";

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

const levelColor: Record<string, string> = {
  "Муниципальный": "bg-primary/10 text-primary border-primary/30",
  "Региональный": "bg-secondary/10 text-secondary border-secondary/30",
  "Федеральный": "bg-accent/15 text-accent-foreground border-accent/30",
  "Международный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
};

const resultOrder = ["1 место", "2 место", "3 место", "5-6 место", "Без места"];

function effectiveStatus(c: CompetitionDto): "upcoming" | "past" | "cancelled" {
  if (c.status === "cancelled") return "cancelled";
  const end = parseDate(c.end_date);
  if (end) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (end < today) return "past";
  }
  return "upcoming";
}

function fmtDate(iso: string): string {
  const d = parseDate(iso);
  return d ? format(d, "d MMMM yyyy", { locale: ru }) : iso;
}

function primaryCompetition(c: CompetitionDto): CompetitionChildDto | null {
  return c.competitions[0] ?? null;
}

function competitionAthletes(c: CompetitionDto): CompetitionParticipantDto[] {
  return primaryCompetition(c)?.participants ?? [];
}

function resultCount(athletes: CompetitionParticipantDto[], result: string) {
  return athletes.filter((a) => a.result === result).length;
}

function CompetitionsPage() {
  const { loading } = useAuthGuard();
  const { user, isAdmin, isCoach } = useAuth();
  const [items, setItems] = useState<CompetitionDto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAthletes, setEditingAthletes] = useState<CompetitionDto | null>(null);
  const [editingDetails, setEditingDetails] = useState<CompetitionDto | null>(null);

  const coachId = user?.id ?? "";
  const coachName = user?.coachName ?? "";

  const load = useCallback(async () => {
    try {
      const data = await fetchCompetitions();
      setItems(data);
      setItemsError(null);
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : "Не удалось загрузить соревнования");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (isCoach) return items.filter((c) => c.coach_id === coachId);
    return items;
  }, [items, isCoach, coachId]);

  const filtered = useMemo(() => {
    return visible.filter((c) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q || c.name.toLowerCase().includes(q) || (c.city ?? "").toLowerCase().includes(q);
      const st = effectiveStatus(c);
      const matchS = statusFilter === "Все" || st === statusFilter;
      const ath = competitionAthletes(c);
      const matchR = resultFilter === "all"
        || (resultFilter === "with_result" && ath.some((a) => a.result && a.result !== "Без места"))
        || (resultFilter === "without_result" && !ath.some((a) => a.result && a.result !== "Без места"));
      return matchQ && matchS && matchR;
    });
  }, [visible, query, statusFilter, resultFilter]);

  const upcoming = useMemo(() => filtered.filter((c) => effectiveStatus(c) === "upcoming"), [filtered]);
  const past = useMemo(() => filtered.filter((c) => effectiveStatus(c) === "past"), [filtered]);
  const cancelled = useMemo(() => filtered.filter((c) => effectiveStatus(c) === "cancelled"), [filtered]);

  const totals = useMemo(() => {
    const totalAthletes = new Set(filtered.flatMap((c) => competitionAthletes(c).map((a) => a.athlete_id))).size;
    const first = filtered.reduce((s, c) => s + resultCount(competitionAthletes(c), "1 место"), 0);
    const withResult = filtered.reduce(
      (s, c) => s + competitionAthletes(c).filter((a) => a.result && a.result !== "Без места").length, 0,
    );
    return { total: filtered.length, totalAthletes, first, withResult };
  }, [filtered]);

  const handleCreate = async (data: CreateCompetitionData) => {
    try {
      await createCompetition({
        name: data.title,
        discipline: data.discipline,
        level: data.level,
        city: data.city,
        location: data.location,
        start_date: isoDate(parseDate(data.date) ?? new Date()),
        end_date: isoDate(parseDate(data.dateEnd ?? data.date) ?? new Date()),
      });
      setShowCreateForm(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось создать соревнование");
    }
  };

  const compOf = (c: CompetitionDto) => primaryCompetition(c);

  const handleUpdate = async (c: CompetitionDto, data: CreateCompetitionData) => {
    const comp = compOf(c);
    try {
      await updateCompetition(c.id, comp?.id ?? "", {
        name: data.title,
        discipline: data.discipline,
        level: data.level,
        city: data.city,
        location: data.location,
        start_date: isoDate(parseDate(data.date) ?? new Date()),
        end_date: isoDate(parseDate(data.dateEnd ?? data.date) ?? new Date()),
      });
      setEditingDetails(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось обновить соревнование");
    }
  };

  const handleDelete = async (c: CompetitionDto) => {
    if (!confirm("Удалить соревнование?")) return;
    try {
      await deleteCompetitionEvent(c.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить соревнование");
    }
  };

  const handleCancel = async (c: CompetitionDto) => {
    if (!confirm("Отменить соревнование?")) return;
    try {
      await cancelCompetition(c.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось отменить соревнование");
    }
  };

  const handleAddAthlete = async (c: CompetitionDto, athlete: AthleteDto) => {
    const comp = compOf(c);
    if (!comp) return;
    try {
      await addCompetitionParticipant(comp.id, athlete.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось добавить спортсмена");
    }
  };

  const handleRemoveAthlete = async (c: CompetitionDto, athleteId: string) => {
    const comp = compOf(c);
    if (!comp) return;
    try {
      await removeCompetitionParticipant(comp.id, athleteId);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить спортсмена");
    }
  };

  const handleSetResult = async (c: CompetitionDto, athleteId: string, result: string | null) => {
    const comp = compOf(c);
    if (!comp) return;
    try {
      if (result) {
        await setCompetitionResult(comp.id, athleteId, result);
      } else {
        await clearCompetitionResult(comp.id, athleteId);
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить результат");
    }
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
            {dataLoading ? "Загрузка…" : `${upcoming.length} предстоящих · ${past.length} прошедших · ${totals.totalAthletes} участников от ЦСЕ`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Добавить соревнование
          </Button>
        </div>
      </div>

      {itemsError && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {itemsError}
        </div>
      )}

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
          {dataLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">Загрузка соревнований…</div>
          )}

          {!dataLoading && filtered.length === 0 && (
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
                    onDelete={isCoach ? () => handleDelete(ev) : undefined}
                    onCancel={isCoach && ev.status !== "cancelled" ? () => handleCancel(ev) : undefined}
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
                    onDelete={isCoach ? () => handleDelete(ev) : undefined}
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
                    onDelete={isCoach ? () => handleDelete(ev) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {showCreateForm && (
        <CompetitionFormModal
          defaultDiscipline="Бокс"
          onSave={handleCreate}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {editingDetails && (
        <CompetitionFormModal
          competition={editingDetails}
          onSave={(data) => handleUpdate(editingDetails, data)}
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
  event: CompetitionDto;
  onEditAthletes?: () => void;
  onEditDetails?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const comp = primaryCompetition(event);
  const athletes = competitionAthletes(event);
  const athleteCount = athletes.length;
  const discipline = comp?.discipline ?? "—";
  const first = resultCount(athletes, "1 место");
  const second = resultCount(athletes, "2 место");
  const third = resultCount(athletes, "3 место");
  const places56 = resultCount(athletes, "5-6 место");
  const hasResults = first > 0 || second > 0 || third > 0 || places56 > 0;
  const st = effectiveStatus(event);
  const title = event.name;
  const city = event.city ?? "";
  const level = event.level ?? "Муниципальный";

  return (
    <Card className={`group border-border p-4 shadow-[var(--shadow-card)] transition hover:shadow-md ${
      event.status === "cancelled" ? "opacity-60 hover:opacity-80" : "hover:border-primary/30"
    }`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate font-display text-sm font-bold text-secondary">
              {title}
            </div>
            {event.status === "cancelled" && (
              <Badge variant="outline" className="shrink-0 border-destructive/30 bg-destructive/10 font-normal text-destructive">
                Отменено
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {city}
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 font-normal ${levelColor[level] ?? levelColor["Муниципальный"]}`}>
          {level}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {fmtDate(event.start_date)}
          {event.end_date !== event.start_date ? ` – ${fmtDate(event.end_date)}` : ""}
        </span>
        <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
          {discipline}
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
            {st === "past" ? <Medal className="mr-1 h-3 w-3" /> : <Users className="mr-1 h-3 w-3" />}
            {st === "past" ? "Результаты" : "Участники"}
          </Button>
        )}
        {onEditDetails && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEditDetails}>
            <Pencil className="mr-1 h-3 w-3" /> Редактировать
          </Button>
        )}
        {onCancel && st === "upcoming" && (
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
  discipline: string;
  level: string;
  date: string;
  dateEnd?: string;
  city: string;
  location?: string;
}

function CompetitionFormModal({ defaultDiscipline, competition, onSave, onClose }: {
  defaultDiscipline?: string;
  competition?: CompetitionDto;
  onSave: (data: CreateCompetitionData) => void;
  onClose: () => void;
}) {
  const comp = competition ? primaryCompetition(competition) : null;
  const isEdit = !!competition;
  const [title, setTitle] = useState(competition?.name ?? "");
  const [discipline, setDiscipline] = useState(comp?.discipline ?? defaultDiscipline ?? "Бокс");
  const [level, setLevel] = useState(competition?.level ?? "Муниципальный");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(competition ? parseDate(competition.start_date) : undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(competition ? parseDate(competition.end_date) : undefined);
  const [city, setCity] = useState(competition?.city ?? "");
  const [location, setLocation] = useState(competition?.location ?? "");

  const dateStr = selectedDate ? format(selectedDate, "dd.MM.yyyy") : "";
  const dateEndStr = selectedEndDate ? format(selectedEndDate, "dd.MM.yyyy") : "";
  const canSave = title.trim() && !!selectedDate && city.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title,
      discipline,
      level,
      date: dateStr,
      dateEnd: dateEndStr || undefined,
      city,
      location,
    });
  };

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
              <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"].map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Уровень *</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["Муниципальный", "Региональный", "Федеральный", "Международный"].map((l) => (<option key={l} value={l}>{l}</option>))}
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
          <Button size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90" disabled={!canSave} onClick={handleSave}>
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
  competition: CompetitionDto;
  coachId: string;
  onAddAthlete: (comp: CompetitionDto, athlete: AthleteDto) => void;
  onRemoveAthlete: (comp: CompetitionDto, athleteId: string) => void;
  onSetResult: (comp: CompetitionDto, athleteId: string, result: string | null) => void;
  onClose: () => void;
}) {
  const [athleteSearch, setAthleteSearch] = useState("");
  const [coachAthletes, setCoachAthletes] = useState<AthleteDto[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setAthletesLoading(true);
    fetchAthletes({ coachId })
      .then((res) => {
        if (!cancelled) {
          setCoachAthletes(res.items);
          setAthletesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCoachAthletes([]);
          setAthletesLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [coachId]);

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return coachAthletes;
    return coachAthletes.filter((a) => athleteFullName(a).toLowerCase().includes(q));
  }, [coachAthletes, athleteSearch]);

  const currentAthletes = competitionAthletes(competition);
  const selectedIds = new Set(currentAthletes.map((a) => a.athlete_id));
  const st = effectiveStatus(competition);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">{competition.name}</h3>
            <p className="text-sm text-muted-foreground">{competition.city} · {fmtDate(competition.start_date)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="px-6 py-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              placeholder="Поиск спортсмена…"
              className="h-9 pl-9"
            />
          </div>

          {currentAthletes.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Участники ({currentAthletes.length})</h4>
              <div className="space-y-2">
                {currentAthletes.map((ath) => (
                  <div key={ath.athlete_id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-sm font-medium text-secondary">{ath.athlete_name}</span>
                    <div className="flex items-center gap-1.5">
                      {st === "past" && (
                        <div className="flex flex-wrap gap-1">
                          {resultOrder.map((r) => (
                            <button
                              key={r}
                              onClick={() => onSetResult(competition, ath.athlete_id, ath.result === r ? null : r)}
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
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={() => onRemoveAthlete(competition, ath.athlete_id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Спортсмены тренера</h4>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {athletesLoading && (
                <p className="py-4 text-center text-xs text-muted-foreground">Загрузка спортсменов…</p>
              )}
              {!athletesLoading && filteredAthletes.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">Спортсмены не найдены</p>
              )}
              {filteredAthletes.map((a) => {
                const isSelected = selectedIds.has(a.id);
                return (
                  <div key={a.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 transition ${
                    isSelected ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/30"
                  }`}>
                    <div>
                      <span className="text-sm font-medium text-secondary">{athleteFullName(a)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{a.rank ?? ""} · {a.sport_type}</span>
                    </div>
                    {!isSelected && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => onAddAthlete(competition, a)}>
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