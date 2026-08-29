import { useState, useMemo, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ClipboardList, Calendar, Users, UserCog,
  CalendarIcon, ChevronLeft, ChevronRight,
  Check, X, FileText, RefreshCw,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useAuthGuard, useAuth } from "@/lib/auth";
import {
  type AttendanceStatus,
  type AttendanceJournalItemDto,
  fetchAttendanceJournal,
  fetchAttendance,
  markAttendance,
  updateAttendance,
  toApiDate,
  parseAttendanceDate,
} from "@/lib/api/attendance.functions";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Посещаемость — СОКОЛ" },
      { name: "description", content: "Журнал посещаемости и тепловая карта." },
    ],
  }),
  component: AttendancePage,
});

const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const statusLabels: Record<AttendanceStatus, string> = {
  present: "Присутствует",
  absent: "Отсутствует",
  excused: "Уважительная",
};
const statusColors: Record<AttendanceStatus, string> = {
  present: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  absent: "bg-destructive/10 text-destructive border-destructive/30",
  excused: "bg-muted text-muted-foreground border-border",
};

type ViewMode = "groups" | "coaches";

type HistoryRecord = {
  date: string;
  status: AttendanceStatus;
  discipline: string | null;
  coach_name: string | null;
  group_name: string | null;
};

function AttendancePage() {
  const { loading, user } = useAuthGuard();
  const { isCoach, isAdmin } = useAuth();

  /* ─── Coach Journal ─── */
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [journalItems, setJournalItems] = useState<AttendanceJournalItemDto[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [applying, setApplying] = useState<string | null>(null);

  const dateStr = format(selectedDate, "dd.MM.yyyy");
  const dateLabel = format(selectedDate, "d MMMM yyyy, EEE", { locale: ru });
  const selectedDateISO = toApiDate(selectedDate);

  const reloadJournal = useCallback(async () => {
    setJournalLoading(true);
    setJournalError(null);
    try {
      const items = await fetchAttendanceJournal(
        selectedDateISO,
        isCoach && user ? user.id : undefined,
      );
      setJournalItems(items);
      setSelectedScheduleId((prev) =>
        items.some((i) => i.schedule_id === prev) ? prev : (items[0]?.schedule_id ?? ""),
      );
    } catch (e) {
      setJournalError(e instanceof Error ? e.message : "Не удалось загрузить журнал");
    } finally {
      setJournalLoading(false);
    }
  }, [selectedDateISO, isCoach, user]);

  useEffect(() => {
    void reloadJournal();
  }, [reloadJournal]);

  const selectedItem = useMemo(
    () => journalItems.find((i) => i.schedule_id === selectedScheduleId) ?? null,
    [journalItems, selectedScheduleId],
  );

  const applyStatus = async (athleteId: string, status: AttendanceStatus) => {
    if (!selectedItem) return;
    const row = selectedItem.athletes.find((a) => a.athlete_id === athleteId);
    setApplying(athleteId);
    try {
      let result;
      if (row?.record_id) {
        result = await updateAttendance(row.record_id, { status });
      } else {
        result = await markAttendance({
          athlete_id: athleteId,
          schedule_id: selectedItem.schedule_id,
          date: selectedDateISO,
          status,
        });
      }
      setJournalItems((prev) =>
        prev.map((item) => {
          if (item.schedule_id !== selectedItem.schedule_id) return item;
          return {
            ...item,
            athletes: item.athletes.map((a) =>
              a.athlete_id === athleteId
                ? { ...a, status, record_id: result.id }
                : a,
            ),
          };
        }),
      );
    } catch (e) {
      setJournalError(e instanceof Error ? e.message : "Не удалось сохранить отметку");
    } finally {
      setApplying(null);
    }
  };

  const stepDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  /* ─── Admin Heatmap ─── */
  const [viewMode, setViewMode] = useState<ViewMode>("groups");
  const today = new Date();
  const startDefault = new Date(today);
  startDefault.setDate(startDefault.getDate() - 27);
  const [filterDateStart, setFilterDateStart] = useState(
    format(startDefault, "dd.MM.yyyy"),
  );
  const [filterDateEnd, setFilterDateEnd] = useState(format(today, "dd.MM.yyyy"));
  const [filterDiscipline, setFilterDiscipline] = useState<string>("Все");
  const [filterCoach, setFilterCoach] = useState<string>("Все");
  const [filterGroup, setFilterGroup] = useState<string>("Все");
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  useEffect(() => {
    const startISO = toApiDate(filterDateStart);
    const endISO = toApiDate(filterDateEnd);
    if (!startISO || !endISO) return;
    setRecordsLoading(true);
    setRecordsError(null);
    fetchAttendance({ dateFrom: startISO, dateTo: endISO, perPage: 2000 })
      .then((res) => {
        setRecords(
          res.items.map((r) => ({
            date: r.date,
            status: r.status,
            discipline: r.discipline,
            coach_name: r.coach_name,
            group_name: r.group_name,
          })),
        );
      })
      .catch((e) =>
        setRecordsError(e instanceof Error ? e.message : "Не удалось загрузить данные"),
      )
      .finally(() => setRecordsLoading(false));
  }, [filterDateStart, filterDateEnd]);

  const disciplineOptions = useMemo(
    () => [...new Set(records.map((r) => r.discipline).filter((v): v is string => Boolean(v)))].sort(),
    [records],
  );
  const coachOptions = useMemo(
    () => [...new Set(records.map((r) => r.coach_name).filter((v): v is string => Boolean(v)))].sort(),
    [records],
  );
  const groupOptions = useMemo(
    () => [...new Set(records.map((r) => r.group_name).filter((v): v is string => Boolean(v)))].sort(),
    [records],
  );

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterDiscipline !== "Все" && r.discipline !== filterDiscipline) return false;
      if (filterCoach !== "Все" && r.coach_name !== filterCoach) return false;
      if (filterGroup !== "Все" && r.group_name !== filterGroup) return false;
      return true;
    });
  }, [records, filterDiscipline, filterCoach, filterGroup]);

  const heatmapData = useMemo(() => {
    const rows = viewMode === "groups"
      ? [...new Set(filteredRecords.map((r) => r.group_name).filter((v): v is string => Boolean(v)))]
      : [...new Set(filteredRecords.map((r) => r.coach_name).filter((v): v is string => Boolean(v)))];

    return rows.map((label) => {
      const rowRecords = viewMode === "groups"
        ? filteredRecords.filter((r) => r.group_name === label)
        : filteredRecords.filter((r) => r.coach_name === label);

      const days = dayNames.map((dayLabel, di) => {
        const dowRecords = rowRecords.filter((r) => {
          const d = parseAttendanceDate(r.date);
          return d ? (d.getDay() + 6) % 7 === di : false;
        });
        if (dowRecords.length === 0) return { label: dayLabel, pct: null };
        const total = dowRecords.length;
        const present = dowRecords.filter((r) => r.status === "present").length;
        return { label: dayLabel, pct: Math.round((present / total) * 100) };
      });

      return { label, days, discipline: rowRecords[0]?.discipline ?? "" };
    });
  }, [viewMode, filteredRecords]);

  const heatColor = (pct: number | null) => {
    if (pct === null) return "bg-muted/30";
    if (pct >= 90) return "bg-[color:var(--success)]/25 text-[color:var(--success)]";
    if (pct >= 75) return "bg-[color:var(--success)]/15 text-[color:var(--success)]";
    if (pct >= 60) return "bg-accent/20 text-accent-foreground";
    if (pct >= 40) return "bg-destructive/15 text-destructive";
    return "bg-destructive/25 text-destructive";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  /* ─── Admin Heatmap Render ─── */
  if (isAdmin) {
    return (
      <AppShell title="Посещаемость" subtitle="Тепловая карта для руководителя">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-secondary">Тепловая карта посещаемости</h2>
            <p className="text-sm text-muted-foreground">
              {heatmapData.length} {viewMode === "groups" ? "групп" : "тренеров"} · {filterDateStart} – {filterDateEnd}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("groups")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "groups"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> По группам
            </button>
            <button
              onClick={() => setViewMode("coaches")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "coaches"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <UserCog className="h-3.5 w-3.5" /> По тренерам
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">С</label>
            <Input value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="h-9 w-28" placeholder="ДД.ММ.ГГГГ" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">По</label>
            <Input value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="h-9 w-28" placeholder="ДД.ММ.ГГГГ" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Дисциплина</label>
            <select
              value={filterDiscipline}
              onChange={(e) => setFilterDiscipline(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="Все">Все</option>
              {disciplineOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Тренер</label>
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="Все">Все</option>
              {coachOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа</label>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="Все">Все</option>
              {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {recordsLoading && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Загрузка данных…
          </div>
        )}
        {recordsError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            {recordsError}
          </div>
        )}

        {/* Legend */}
        <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Посещаемость:</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-[color:var(--success)]/25" /> ≥90%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-[color:var(--success)]/15" /> 75–89%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-accent/20" /> 60–74%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-destructive/15" /> 40–59%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-destructive/25" /> {"<40%"}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-muted/30" /> Нет данных</span>
        </div>

        {/* Heatmap table */}
        <Card className="overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {viewMode === "groups" ? "Группа" : "Тренер"}
                  </th>
                  {dayNames.map((d) => (
                    <th key={d} className="px-3 py-3 text-center font-medium">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {heatmapData.map((row) => (
                  <tr key={row.label} className="transition hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-medium text-secondary">{row.label}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{row.discipline}</span>
                    </td>
                    {row.days.map((day) => (
                      <td key={day.label} className="px-3 py-3 text-center">
                        <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${heatColor(day.pct)}`}>
                          {day.pct !== null ? `${day.pct}%` : "—"}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                {heatmapData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Нет данных по выбранным фильтрам
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </AppShell>
    );
  }

  /* ─── Coach Journal Render ─── */

  const markedRows = selectedItem ? selectedItem.athletes.filter((a) => a.status !== null) : [];
  const presentCount = markedRows.filter((a) => a.status === "present").length;
  const absentCount = markedRows.filter((a) => a.status === "absent").length;
  const excusedCount = markedRows.filter((a) => a.status === "excused").length;

  return (
    <AppShell title="Посещаемость" subtitle="Журнал отметок">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Журнал посещаемости</h2>
          <p className="text-sm text-muted-foreground">
            {journalItems.length} занятий в расписании · {selectedItem ? selectedItem.athletes.length : 0} спортсменов
          </p>
        </div>
        {journalError && (
          <span className="text-xs text-destructive">{journalError}</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => stepDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  locale={ru}
                  selected={selectedDate}
                  onSelect={(d) => { if (d) setSelectedDate(d); }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => stepDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {journalItems.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{dateLabel}</span>
            )}
          </div>
          {journalLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Загрузка журнала…
            </div>
          ) : !selectedItem ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Нет занятий в расписании
            </div>
          ) : (
            <>
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-secondary">{selectedItem.group_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[selectedItem.discipline, selectedItem.coach_name ? `тренер: ${selectedItem.coach_name}` : ""]
                        .filter(Boolean)
                        .join(" · ")}{" · "}
                      {selectedItem.start_time}–{selectedItem.end_time}
                      {selectedItem.room ? ` · ${selectedItem.room}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                    {dateStr}
                  </Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium w-12">#</th>
                      <th className="px-4 py-3 font-medium">Спортсмен</th>
                      <th className="px-4 py-3 font-medium">Разряд</th>
                      <th className="px-4 py-3 font-medium">Статус</th>
                      <th className="px-4 py-3 font-medium">Отметка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedItem.athletes.map((a, i) => {
                      const current = a.status ?? "present";
                      const isApplying = applying === a.athlete_id;
                      return (
                        <tr key={a.athlete_id} className="transition hover:bg-muted/20">
                          <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-primary-foreground">
                                {a.athlete_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </div>
                              <span className="font-medium text-secondary">{a.athlete_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{a.rank || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`font-normal ${statusColors[current]}`}>
                              {statusLabels[current]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              {(["present", "absent", "excused"] as AttendanceStatus[]).map((s) => (
                                <button
                                  key={s}
                                  disabled={isApplying}
                                  onClick={() => void applyStatus(a.athlete_id, s)}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                                    current === s
                                      ? s === "present" ? "border-[color:var(--success)] bg-[color:var(--success)]/10 text-[color:var(--success)]"
                                        : s === "absent" ? "border-destructive bg-destructive/10 text-destructive"
                                        : "border-border bg-muted text-muted-foreground"
                                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                  }`}
                                >
                                  {s === "present" ? <Check className="h-3.5 w-3.5" /> : s === "absent" ? <X className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {selectedItem.athletes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                          Нет спортсменов в этой группе
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="shadow-[var(--shadow-card)]">
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold text-secondary">
                  <Calendar className="h-4 w-4" /> Расписание
                </h4>
                <span className="text-xs text-muted-foreground">Группы</span>
              </div>
            </div>
            <div className="space-y-1 p-3">
              {journalItems.map((item) => {
                const isSelected = item.schedule_id === selectedScheduleId;
                const marked = item.athletes.filter((a) => a.status !== null);
                const allMarked = marked.length === item.athletes.length && item.athletes.length > 0;
                const someMarked = marked.length > 0 && marked.length < item.athletes.length;
                const present = marked.filter((a) => a.status === "present").length;
                return (
                  <button
                    key={item.schedule_id}
                    onClick={() => setSelectedScheduleId(item.schedule_id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : `border-border hover:border-primary/30 hover:bg-muted/30 ${
                            allMarked ? "border-l-green-500" : someMarked ? "border-l-yellow-500" : ""
                          }`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isSelected ? "text-primary" : "text-secondary"}`}>
                        {item.group_name}
                      </span>
                      {marked.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {present}/{marked.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {item.start_time}–{item.end_time}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{item.room || ""}</div>
                  </button>
                );
              })}
              {journalItems.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Нет занятий</p>
              )}
            </div>
          </Card>

          {selectedItem && (
            <Card className="shadow-[var(--shadow-card)]">
              <div className="border-b border-border px-5 py-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-secondary">
                  <ClipboardList className="h-4 w-4" /> Статистика
                </h4>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Присутствует</span>
                  <span className="font-medium text-[color:var(--success)]">{presentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Отсутствует</span>
                  <span className="font-medium text-destructive">{absentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Уважительная</span>
                  <span className="font-medium text-muted-foreground">{excusedCount}</span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex items-center justify-between font-medium text-secondary">
                    <span>Посещаемость</span>
                    <span className="font-display text-lg font-bold text-primary">
                      {selectedItem.athletes.length > 0
                        ? Math.round(
                            (selectedItem.athletes.filter((a) => a.status !== "absent" && a.status !== null).length / selectedItem.athletes.length) * 100,
                          )
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}