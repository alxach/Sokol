import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search, TrendingUp, Users, UsersRound, Dumbbell, FileDown, X, Pencil, CalendarIcon } from "lucide-react";

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
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { coaches, getCoachStatus, isOnVacation, isOnSickLeave, type Coach, type Discipline, type VacationPeriod } from "@/lib/mock-data";
import { exportToExcel } from "@/lib/api/exports.functions";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function downloadBase64(base64: string, filename: string) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const byteArr = new Uint8Array(byteNums);
  const blob = new Blob([byteArr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [exporting, setExporting] = useState(false);
  const [coachesList, setCoachesList] = useState(coaches);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailCoach, setDetailCoach] = useState<Coach | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportToExcel({ data: { type: "coaches", data: filtered } });
      downloadBase64(result.base64, result.filename);
    } catch (err) {
      console.error(err);
      alert("Не удалось создать Excel-файл.");
    } finally {
      setExporting(false);
    }
  };

  const filtered = useMemo(() => {
    return coachesList.filter((c) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q);
      const matchD = discipline === "Все" || c.disciplines.includes(discipline);
      return matchQ && matchD;
    });
  }, [query, discipline, coachesList]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => getCoachStatus(c) === "Активный").length;
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
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <FileDown className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" /> Фильтры
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailCoach(c)}>
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
                    <Badge variant="outline" className={`font-normal ${statusStyle[getCoachStatus(c)]}`}>
                      {getCoachStatus(c)}
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

      {showCreateModal && (
        <CoachModal
          onClose={() => setShowCreateModal(false)}
          onSaved={(newCoach) => {
            setCoachesList((prev) => [...prev, newCoach]);
            setShowCreateModal(false);
          }}
        />
      )}

      {detailCoach && (
        <CoachDetailModal
          coach={detailCoach}
          onClose={() => setDetailCoach(null)}
          onSaved={(updated) => {
            setCoachesList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setDetailCoach(null);
          }}
        />
      )}
    </AppShell>
  );
}

const rankOptions = [
  "Заслуженный тренер России",
  "Тренер высшей категории",
  "Тренер первой категории",
  "Тренер второй категории",
  "Без категории",
];
const coachStatusOptions: Coach["status"][] = ["Активный", "Отпуск", "На больничном"];

function CoachDetailModal({
  coach,
  onClose,
  onSaved,
}: {
  coach: Coach;
  onClose: () => void;
  onSaved: (updated: Coach) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(coach.name);
  const [city, setCity] = useState(coach.city);
  const [selectedDisciplines, setSelectedDisciplines] = useState<Discipline[]>([...coach.disciplines]);
  const [status, setStatus] = useState(coach.status);
  const [vacations, setVacations] = useState<VacationPeriod[]>(
    (coach.vacations ?? []).map((v) => ({ ...v })),
  );
  const [sickLeaves, setSickLeaves] = useState<VacationPeriod[]>(
    (coach.sickLeaves ?? []).map((s) => ({ ...s })),
  );
  const [email, setEmail] = useState(coach.email ?? "");
  const [phone, setPhone] = useState(coach.phone ?? "");
  const [telegram, setTelegram] = useState(coach.telegram ?? "");
  const [experience, setExperience] = useState(coach.experience);
  const [rank, setRank] = useState(coach.rank ?? "Без категории");
  const [education, setEducation] = useState(coach.education ?? "");
  const [groups, setGroups] = useState(coach.groups);
  const [athletes, setAthletes] = useState(coach.athletes);
  const [workload, setWorkload] = useState(coach.workload);
  const [efficiency, setEfficiency] = useState(coach.efficiency);
  const [rating, setRating] = useState(coach.rating);

  const allDisciplines: Discipline[] = ["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];

  const toggleDiscipline = (d: Discipline) => {
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (selectedDisciplines.length === 0) return;
    onSaved({
      ...coach,
      name: name.trim(),
      city: city.trim(),
      disciplines: selectedDisciplines,
      status,
      vacations: vacations.filter((v) => v.start && v.end),
      sickLeaves: sickLeaves.filter((s) => s.start && s.end),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      telegram: telegram.trim() || undefined,
      experience,
      rank: rank || undefined,
      education: education.trim() || undefined,
      groups,
      athletes,
      workload,
      efficiency,
      rating,
    });
  };

  const initials = coach.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-sm font-bold text-secondary">Карточка тренера</h3>
          <div className="flex items-center gap-2">
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Редактировать
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Avatar + Name + ID */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-xl font-bold text-primary-foreground">
              {initials}
            </div>
            <div>
              {editing ? (
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-base font-bold" />
              ) : (
                <div className="font-display text-xl font-bold text-secondary">{coach.name}</div>
              )}
              <div className="text-xs text-muted-foreground">{coach.id}</div>
            </div>
          </div>

          {/* Статистика (всегда readonly) */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold text-secondary">{editing ? <Input type="number" min={0} value={groups} onChange={(e) => setGroups(Number(e.target.value))} className="h-8 text-center" /> : groups}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Групп</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold text-secondary">{editing ? <Input type="number" min={0} value={athletes} onChange={(e) => setAthletes(Number(e.target.value))} className="h-8 text-center" /> : athletes}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Спортсменов</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className={`text-lg font-bold ${workloadColor(workload)}`}>
                {editing ? <Input type="number" min={0} max={100} value={workload} onChange={(e) => setWorkload(Number(e.target.value))} className="h-8 text-center" /> : `${workload}%`}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Нагрузка</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold text-primary">
                {editing ? <Input type="number" min={0} max={100} value={efficiency} onChange={(e) => setEfficiency(Number(e.target.value))} className="h-8 text-center" /> : `${efficiency}%`}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Эффективность</div>
            </div>
          </div>

          {/* Основное */}
          <div className="border-t border-border pt-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Основное</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Город</span>
                {editing ? (
                  <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-0.5 h-9" />
                ) : (
                  <div className="font-medium text-secondary">{coach.city}</div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Статус</span>
                {editing ? (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Coach["status"])}
                    className="mt-0.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {coachStatusOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <div><Badge variant="outline" className={`font-normal ${statusStyle[getCoachStatus(coach)]}`}>{getCoachStatus(coach)}</Badge></div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Дисциплины</span>
                {editing ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {allDisciplines.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDiscipline(d)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                          selectedDisciplines.includes(d)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {coach.disciplines.map((d) => (
                      <Badge key={d} variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">{d}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Рейтинг</span>
                {editing ? (
                  <Input type="number" min={0} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="mt-0.5 h-9" />
                ) : (
                  <div className="font-medium text-secondary">{coach.rating}</div>
                )}
              </div>
            </div>
          </div>

          {/* Отпуск */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Отпуск</h4>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  isOnVacation(vacations) ? "bg-primary/10 text-primary border-primary/30" : "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
                }`}>
                  {isOnVacation(vacations) ? "В отпуске" : "Работает"}
                </span>
                {editing && (
                  <button
                    onClick={() => setVacations((prev) => [...prev, { start: "", end: "" }])}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {vacations.length === 0 && !editing && (
              <p className="text-sm text-muted-foreground">Нет запланированных отпусков</p>
            )}
            <div className="space-y-2">
              {vacations.map((v, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-2.5">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      {editing ? (
                        <input
                          type="date"
                          value={v.start}
                          onChange={(e) => {
                            setVacations((prev) => {
                              const next = prev.map((x) => ({ ...x }));
                              next[i].start = e.target.value;
                              return next;
                            });
                          }}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      ) : (
                        <div className="mt-0.5 text-xs"><span className="text-muted-foreground">С </span><span className="font-medium text-secondary">{v.start || "—"}</span></div>
                      )}
                    </div>
                    <div className="flex-1">
                      {editing ? (
                        <input
                          type="date"
                          value={v.end}
                          onChange={(e) => {
                            setVacations((prev) => {
                              const next = prev.map((x) => ({ ...x }));
                              next[i].end = e.target.value;
                              return next;
                            });
                          }}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      ) : (
                        <div className="mt-0.5 text-xs"><span className="text-muted-foreground">По </span><span className="font-medium text-secondary">{v.end || "—"}</span></div>
                      )}
                    </div>
                  </div>
                  {editing && (
                    <button
                      onClick={() => setVacations((prev) => prev.filter((_, j) => j !== i))}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Больничный */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Больничный</h4>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  isOnSickLeave(sickLeaves) ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
                }`}>
                  {isOnSickLeave(sickLeaves) ? "На больничном" : "Здоров"}
                </span>
                {editing && (
                  <button
                    onClick={() => setSickLeaves((prev) => [...prev, { start: "", end: "" }])}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {sickLeaves.length === 0 && !editing && (
              <p className="text-sm text-muted-foreground">Нет записей о больничном</p>
            )}
            <div className="space-y-2">
              {sickLeaves.map((s, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-2.5">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      {editing ? (
                        <input
                          type="date"
                          value={s.start}
                          onChange={(e) => {
                            setSickLeaves((prev) => {
                              const next = prev.map((x) => ({ ...x }));
                              next[i].start = e.target.value;
                              return next;
                            });
                          }}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      ) : (
                        <div className="mt-0.5 text-xs"><span className="text-muted-foreground">С </span><span className="font-medium text-secondary">{s.start || "—"}</span></div>
                      )}
                    </div>
                    <div className="flex-1">
                      {editing ? (
                        <input
                          type="date"
                          value={s.end}
                          onChange={(e) => {
                            setSickLeaves((prev) => {
                              const next = prev.map((x) => ({ ...x }));
                              next[i].end = e.target.value;
                              return next;
                            });
                          }}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      ) : (
                        <div className="mt-0.5 text-xs"><span className="text-muted-foreground">По </span><span className="font-medium text-secondary">{s.end || "—"}</span></div>
                      )}
                    </div>
                  </div>
                  {editing && (
                    <button
                      onClick={() => setSickLeaves((prev) => prev.filter((_, j) => j !== i))}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Контакты */}
          <div className="border-t border-border pt-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Контакты</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Email</span>
                {editing ? (
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-0.5 h-9" />
                ) : (
                  <div className="font-medium text-secondary">{coach.email || "—"}</div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Телефон</span>
                {editing ? (
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-0.5 h-9" />
                ) : (
                  <div className="font-medium text-secondary">{coach.phone || "—"}</div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Telegram</span>
                {editing ? (
                  <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="mt-0.5 h-9" />
                ) : (
                  <div className="font-medium text-secondary">{coach.telegram || "—"}</div>
                )}
              </div>
            </div>
          </div>

          {/* Профессиональные */}
          <div className="border-t border-border pt-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Профессиональные данные</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Стаж</span>
                {editing ? (
                  <Input type="number" min={0} value={experience} onChange={(e) => setExperience(Number(e.target.value))} className="mt-0.5 h-9" />
                ) : (
                  <div className="font-medium text-secondary">{coach.experience} лет</div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Категория / Разряд</span>
                {editing ? (
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className="mt-0.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {rankOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <div className="font-medium text-secondary">{coach.rank || "—"}</div>
                )}
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Образование</span>
                {editing ? (
                  <Input value={education} onChange={(e) => setEducation(e.target.value)} className="mt-0.5 h-9" />
                ) : (
                  <div className="font-medium text-secondary">{coach.education || "—"}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>Отменить</Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || selectedDisciplines.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Сохранить
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CoachModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (coach: Coach) => void;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<Discipline[]>([]);
  const [status, setStatus] = useState<Coach["status"]>("Активный");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [experience, setExperience] = useState(1);
  const [rank, setRank] = useState(rankOptions[4]);
  const [education, setEducation] = useState("");

  const allDisciplines: Discipline[] = ["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];

  const toggleDiscipline = (d: Discipline) => {
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (selectedDisciplines.length === 0) return;
    const lastId = coaches
      .map((c) => Number(c.id.replace("TR-", "")))
      .reduce((max, n) => Math.max(max, n), 0);
    const newCoach: Coach = {
      id: `TR-${String(lastId + 1).padStart(3, "0")}`,
      name: name.trim(),
      disciplines: selectedDisciplines,
      groups: 0,
      athletes: 0,
      workload: 0,
      rating: 1000,
      efficiency: 0,
      status,
      city: city.trim() || "Не указано",
      experience,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      telegram: telegram.trim() || undefined,
      rank: rank || undefined,
      education: education.trim() || undefined,
    };
    onSaved(newCoach);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Новый тренер</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 p-5">
          {/* Основное */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван Петрович" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Город</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" className="h-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Coach["status"])}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {coachStatusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Дисциплины */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Дисциплины *</label>
            <div className="flex flex-wrap gap-2">
              {allDisciplines.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDiscipline(d)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    selectedDisciplines.includes(d)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Контакты */}
          <div className="border-t border-border pt-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Контакты</h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@sokol.ru" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Телефон</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" className="h-9" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Telegram</label>
                  <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" className="h-9" />
                </div>
              </div>
            </div>
          </div>

          {/* Профессиональные */}
          <div className="border-t border-border pt-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Профессиональные данные</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Стаж (лет)</label>
                <Input type="number" min={0} value={experience} onChange={(e) => setExperience(Number(e.target.value))} className="h-9" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория / Разряд</label>
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
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Образование</label>
              <Input value={education} onChange={(e) => setEducation(e.target.value)} placeholder="ВУЗ, год окончания" className="h-9" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="outline" className="flex-1">Отмена</Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || selectedDisciplines.length === 0}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Добавить
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
