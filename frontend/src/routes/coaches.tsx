import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarIcon,
  Dumbbell,
  FileDown,
  Loader2,
  Search,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { exportToExcel } from "@/lib/api/exports.functions";
import {
  coachStatusTitle,
  createCoach,
  fetchCoaches,
  updateCoach,
  type CoachDto,
  type CoachLeaveEntry,
} from "@/lib/api/coaches.functions";
import { LeaveSection } from "@/components/coach/LeaveSection";
import type { Center } from "@/lib/api/organizations.functions";
import { fetchCenters } from "@/lib/api/organizations.functions";

export const Route = createFileRoute("/coaches")({
  head: () => ({
    meta: [
      { title: "Тренеры — СОКОЛ" },
      { name: "description", content: "Управление тренерским составом: профили, нагрузка, статусы." },
    ],
  }),
  component: CoachesPage,
});

const statusStyle: Record<string, string> = {
  "Активный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  "Отпуск": "bg-primary/10 text-primary border-primary/30",
  "На больничном": "bg-destructive/10 text-destructive border-destructive/30",
  "Архив": "bg-muted text-muted-foreground border-border",
};

const rankOptions = [
  "Заслуженный тренер России",
  "Тренер высшей категории",
  "Тренер первой категории",
  "Тренер второй категории",
  "Без категории",
];

function yearsSince(dateString: string): number {
  const from = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - from.getFullYear();
  if (
    now.getMonth() < from.getMonth() ||
    (now.getMonth() === from.getMonth() && now.getDate() < from.getDate())
  ) {
    years -= 1;
  }
  return Math.max(years, 0);
}

function formatDate(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function CoachesPage() {
  const { loading } = useAuthGuard();
  const { isAdmin, isDirector, isSuperadmin } = useAuth();
  const canManage = isAdmin || isDirector || isSuperadmin;
  const [query, setQuery] = useState("");
  const [specialization, setSpecialization] = useState<string>("Все");
  const [exporting, setExporting] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [coachesList, setCoachesList] = useState<CoachDto[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailCoach, setDetailCoach] = useState<CoachDto | null>(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      setCoachesList(await fetchCoaches());
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const specializations = useMemo(() => {
    const set = new Set(coachesList.map((c) => c.specialization).filter(Boolean));
    return ["Все", ...Array.from(set).sort()];
  }, [coachesList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coachesList.filter((c) => {
      const matchQ =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.center_name ?? "").toLowerCase().includes(q) ||
        (c.center_city ?? "").toLowerCase().includes(q);
      const matchS = specialization === "Все" || c.specialization === specialization;
      return matchQ && matchS;
    });
  }, [query, specialization, coachesList]);

  const maxAthletes = useMemo(
    () => (coachesList.length ? Math.max(...coachesList.map((c) => c.athletes_count), 1) : 1),
    [coachesList],
  );

  const workload = (c: CoachDto) =>
    maxAthletes ? Math.round((c.athletes_count / maxAthletes) * 100) : 0;

  const totals = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => coachStatusTitle(c) === "Активный").length;
    const sumAthletes = filtered.reduce((s, c) => s + c.athletes_count, 0);
    return { total, active, sumAthletes };
  }, [filtered]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportToExcel({
        data: {
          type: "coaches",
          data: filtered.map((c) => ({
            id: c.id,
            name: c.name,
            specialization: c.specialization,
            groups_count: c.groups_count,
            athletes_count: c.athletes_count,
            workload: workload(c),
            status: coachStatusTitle(c),
            center_name: c.center_name,
            center_city: c.center_city,
            years: yearsSince(c.hire_date),
          })),
        },
      });
      const byteChars = atob(result.base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const byteArr = new Uint8Array(byteNums);
      const blob = new Blob([byteArr], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Не удалось создать Excel-файл.");
    } finally {
      setExporting(false);
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
    <AppShell title="Тренеры" subtitle="Управление тренерским составом">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Тренерский состав</h2>
          <p className="text-sm text-muted-foreground">
            {totals.total} в выборке · {totals.active} активных · {totals.sumAthletes} спортсменов
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <FileDown className="mr-2 h-4 w-4" /> Excel
            </Button>
            {isSuperadmin && (
              <Button onClick={() => setShowCreateModal(true)}>
                Добавить
              </Button>
            )}
          </div>
        )}
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MiniStat label="Всего в выборке" value={totals.total.toString()} accent="primary" icon={<UsersRound className="h-4 w-4" />} />
        <MiniStat label="Активных" value={totals.active.toString()} accent="success" icon={<Users className="h-4 w-4" />} />
        <MiniStat label="Спортсменов на нагрузке" value={totals.sumAthletes.toString()} accent="accent" icon={<Dumbbell className="h-4 w-4" />} />
      </section>

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени, ID, центру, городу…"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {specializations.map((s) => (
              <button
                key={s}
                onClick={() => setSpecialization(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  specialization === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {s}
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
                <TableHead>Специализация</TableHead>
                <TableHead className="text-center">Групп</TableHead>
                <TableHead className="text-center">Спортсменов</TableHead>
                <TableHead className="text-center">Нагрузка</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingList && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loadingList &&
                filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailCoach(c)}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-xs font-bold text-primary-foreground">
                          {initialsOf(c.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-secondary">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.center_name ?? "Без центра"}
                            {c.center_city ? ` · ${c.center_city}` : ""} · {yearsSince(c.hire_date)} лет стажа
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                        {c.specialization}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium text-secondary">{c.groups_count}</TableCell>
                    <TableCell className="text-center font-medium text-secondary">{c.athletes_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${workload(c)}%`,
                              background:
                                workload(c) >= 85
                                  ? "var(--success)"
                                  : workload(c) >= 65
                                    ? "var(--color-primary)"
                                    : "var(--color-destructive)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{workload(c)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-normal ${statusStyle[coachStatusTitle(c)]}`}>
                        {coachStatusTitle(c)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              {!loadingList && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    Ничего не найдено по выбранным фильтрам.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {showCreateModal && (
        <CoachCreateModal
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
          editable={canManage}
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

function CoachDetailModal({
  coach,
  editable,
  onClose,
  onSaved,
}: {
  coach: CoachDto;
  editable: boolean;
  onClose: () => void;
  onSaved: (updated: CoachDto) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialization, setSpecialization] = useState(coach.specialization);
  const [qualification, setQualification] = useState(coach.qualification ?? "Без категории");
  const [biography, setBiography] = useState(coach.biography ?? "");
  const [isActive, setIsActive] = useState(coach.is_active);
  const [vacations, setVacations] = useState<CoachLeaveEntry[]>(
    coach.vacations.map((v) => ({ start_date: v.start_date, end_date: v.end_date })),
  );
  const [sickLeaves, setSickLeaves] = useState<CoachLeaveEntry[]>(
    coach.sick_leaves.map((s) => ({ start_date: s.start_date, end_date: s.end_date })),
  );

  const toggleEdit = () => {
    if (!editing) {
      setSpecialization(coach.specialization);
      setQualification(coach.qualification ?? "Без категории");
      setBiography(coach.biography ?? "");
      setIsActive(coach.is_active);
      const v = coach.vacations.map((x) => ({ start_date: x.start_date, end_date: x.end_date }));
      if (v.length === 0) v.push({ start_date: "", end_date: "" });
      setVacations(v);
      const s = coach.sick_leaves.map((x) => ({ start_date: x.start_date, end_date: x.end_date }));
      if (s.length === 0) s.push({ start_date: "", end_date: "" });
      setSickLeaves(s);
      setError(null);
      setEditing(true);
    } else {
      setEditing(false);
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!specialization.trim()) {
      setError("Укажите специализацию.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCoach(coach.id, {
        specialization: specialization.trim(),
        qualification: qualification.trim() || null,
        biography: biography.trim() || null,
        is_active: isActive,
        vacations: vacations.filter((v) => v.start_date && v.end_date),
        sick_leaves: sickLeaves.filter((s) => s.start_date && s.end_date),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения.");
      setSaving(false);
    }
  };

  const updatePeriod = (
    list: CoachLeaveEntry[],
    setter: (v: CoachLeaveEntry[]) => void,
    index: number,
    field: "start_date" | "end_date",
    value: string,
  ) => {
    const next = list.map((x) => ({ ...x }));
    next[index][field] = value;
    setter(next);
  };

  const initials = initialsOf(coach.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-sm font-bold text-secondary">Карточка тренера</h3>
          <div className="flex items-center gap-2">
            {editable && !editing && (
              <Button variant="outline" size="sm" onClick={toggleEdit}>
                Редактировать
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-xl font-bold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-xl font-bold text-secondary">{coach.name}</div>
              <div className="text-xs text-muted-foreground">{coach.id}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold text-secondary">{coach.groups_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Групп</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold text-secondary">{coach.athletes_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Спортсменов</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold text-secondary">{yearsSince(coach.hire_date)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Лет стажа</div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Основное</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Центр</span>
                <div className="mt-0.5 font-medium text-secondary">
                  {coach.center_name ?? "—"}
                  {coach.center_city ? ` (${coach.center_city})` : ""}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Статус</span>
                <div className="mt-0.5">
                  <Badge variant="outline" className={`font-normal ${statusStyle[coachStatusTitle(coach)]}`}>
                    {coachStatusTitle(coach)}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Специализация</span>
                {editing ? (
                  <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="mt-0.5 h-9" />
                ) : (
                  <div className="mt-0.5 font-medium text-secondary">{coach.specialization}</div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Категория</span>
                {editing ? (
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="mt-0.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {rankOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-0.5 font-medium text-secondary">{coach.qualification ?? "—"}</div>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Трудоустроен</span>
                <div className="mt-0.5 font-medium text-secondary">{formatDate(coach.hire_date)}</div>
              </div>
              {editing && (
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-[var(--color-primary)]"
                    />
                    <span className="text-sm text-muted-foreground">Активная запись</span>
                  </label>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Биография</span>
                {editing ? (
                  <textarea
                    value={biography}
                    onChange={(e) => setBiography(e.target.value)}
                    rows={3}
                    placeholder="Краткая информация о тренере"
                    className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : (
                  <div className="mt-0.5 whitespace-pre-line text-sm text-secondary">{coach.biography || "—"}</div>
                )}
              </div>
            </div>
          </div>

          <LeaveSection
            title="Отпуск"
            periods={vacations}
            editing={editing}
            tone="primary"
            emptyLabel="Нет запланированных отпусков"
            onAdd={() => setVacations((prev) => [...prev, { start_date: "", end_date: "" }])}
            onRemove={(i) => setVacations((prev) => prev.filter((_, j) => j !== i))}
            onUpdate={(i, field, value) => updatePeriod(vacations, setVacations, i, field, value)}
            onValidate={(periods) => {
              const valid = periods.filter((p) => p.start_date && p.end_date);
              for (let i = 0; i < valid.length; i++) {
                for (let j = i + 1; j < valid.length; j++) {
                  const a = valid[i];
                  const b = valid[j];
                  const startA = new Date(`${a.start_date}T00:00:00`);
                  const endA = new Date(`${a.end_date}T00:00:00`);
                  const startB = new Date(`${b.start_date}T00:00:00`);
                  const endB = new Date(`${b.end_date}T00:00:00`);
                  if (startA <= endB && startB <= endA) {
                    return `Отпуск: периоды ${i + 1} и ${j + 1} пересекаются`;
                  }
                }
              }
              return null;
            }}
          />

          <LeaveSection
            title="Больничный"
            periods={sickLeaves}
            editing={editing}
            tone="destructive"
            emptyLabel="Нет записей о больничном"
            onAdd={() => setSickLeaves((prev) => [...prev, { start_date: "", end_date: "" }])}
            onRemove={(i) => setSickLeaves((prev) => prev.filter((_, j) => j !== i))}
            onUpdate={(i, field, value) => updatePeriod(sickLeaves, setSickLeaves, i, field, value)}
            onValidate={(periods) => {
              const valid = periods.filter((p) => p.start_date && p.end_date);
              for (let i = 0; i < valid.length; i++) {
                for (let j = i + 1; j < valid.length; j++) {
                  const a = valid[i];
                  const b = valid[j];
                  const startA = new Date(`${a.start_date}T00:00:00`);
                  const endA = new Date(`${a.end_date}T00:00:00`);
                  const startB = new Date(`${b.start_date}T00:00:00`);
                  const endB = new Date(`${b.end_date}T00:00:00`);
                  if (startA <= endB && startB <= endA) {
                    return `Больничный: периоды ${i + 1} и ${j + 1} пересекаются`;
                  }
                }
              }
              return null;
            }}
          />

          {editing && error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        {editing && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button variant="outline" onClick={toggleEdit} disabled={saving}>Отменить</Button>
            <Button onClick={handleSave} disabled={saving || !specialization.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface AdminUserOption {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  roles: { code: string }[];
}

function CoachCreateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (coach: CoachDto) => void;
}) {
  const [users, setUsers] = useState<AdminUserOption[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [qualification, setQualification] = useState(rankOptions[4]);
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [biography, setBiography] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [userResp, centerList] = await Promise.all([
          fetch("/api/v1/users?per_page=100").then((r) => r.json()),
          fetchCenters(),
        ]);
        const data: AdminUserOption[] = Array.isArray(userResp.data) ? userResp.data : [];
        setUsers(data);
        setCenters(centerList);
        if (data.length) setUserId(data[0].id);
        if (centerList.length) setCenterId(centerList[0].id);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Не удалось загрузить данные.");
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!userId) {
      setError("Выберите пользователя.");
      return;
    }
    if (!specialization.trim()) {
      setError("Укажите специализацию.");
      return;
    }
    if (!hireDate) {
      setError("Укажите дату трудоустройства.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const coach = await createCoach({
        user_id: userId,
        center_id: centerId || null,
        specialization: specialization.trim(),
        qualification: qualification === "Без категории" ? null : qualification,
        biography: biography.trim() || null,
        hire_date: hireDate,
        is_active: true,
      });
      onSaved(coach);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать тренера.");
      setSaving(false);
    }
  };

  const eligibleUsers = users.filter(
    (u) => u.roles.some((r) => ["coach", "director"].includes(r.code)),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Новый тренер</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 p-5">
          {loadError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
            </p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Загружаем пользователей…
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Пользователь *
                </label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {[u.last_name, u.first_name, u.middle_name].filter(Boolean).join(" ")} · {u.email}
                    </option>
                  ))}
                  {eligibleUsers.length === 0 && (
                    <option value="">Нет пользователей с ролью тренера</option>
                  )}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Сначала создайте пользователя в «Пользователи», если его нет в списке.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Центр</label>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Без центра</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Специализация *</label>
                  <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Дзюдо" className="h-9" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория</label>
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {rankOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата трудоустройства *</label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Биография</label>
                <textarea
                  value={biography}
                  onChange={(e) => setBiography(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button onClick={onClose} variant="outline" className="flex-1" disabled={saving}>Отмена</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || eligibleUsers.length === 0 || !specialization.trim()}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Добавить
                </Button>
              </div>
            </>
          )}
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