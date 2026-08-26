import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ClipboardList, Save, Calendar, Users, UserCog,
  CalendarIcon, ChevronLeft, ChevronRight,
  Check, X, FileText,
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
  schedules, athletes, attendanceRecords,
  type AttendanceStatus, type Discipline,
  freshAttendanceId, persistAttendanceRecords,
  getGroupName,
} from "@/lib/mock-data";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Посещаемость — СОКОЛ" },
      { name: "description", content: "Журнал посещаемости и тепловая карта." },
    ],
  }),
  component: AttendancePage,
});

const DISCIPLINES: Discipline[] = ["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];
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

function AttendancePage() {
  const { loading, user } = useAuthGuard();
  const { isCoach, isAdmin } = useAuth();

  /* ─── Coach Journal ─── */
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(schedules[0]?.id ?? "");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dirty, setDirty] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus>>({});

  const dateStr = format(selectedDate, "dd.MM.yyyy");
  const dateLabel = format(selectedDate, "d MMMM yyyy, EEE", { locale: ru });

  const coachSchedules = useMemo(
    () => (isCoach && user ? schedules.filter((s) => s.coachId === user.id) : schedules),
    [isCoach, user],
  );

  const dayOfWeek = selectedDate.getDay() || 7; // 0(Вс)→7, 1(Пн)→1 … 6(Сб)→6

  const daySchedules = useMemo(
    () => coachSchedules.filter((s) => s.dayOfWeek === dayOfWeek),
    [coachSchedules, dayOfWeek],
  );

  const selectedSchedule = useMemo(
    () => daySchedules.find((s) => s.id === selectedScheduleId),
    [daySchedules, selectedScheduleId],
  );

  useEffect(() => {
    if (daySchedules.length > 0 && !daySchedules.some((s) => s.id === selectedScheduleId)) {
      setSelectedScheduleId(daySchedules[0].id);
      setDirty(false);
      setOverrides({});
    }
  }, [dayOfWeek]);

  const groupAthletes = useMemo(() => {
    if (!selectedSchedule) return [];
    return athletes.filter((a) => a.coach === selectedSchedule.coachName);
  }, [selectedSchedule]);

  const athleteCountBySchedule = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of daySchedules) {
      map[s.id] = athletes.filter((a) => a.coach === s.coachName).length;
    }
    return map;
  }, [daySchedules]);

  const existingRecords = useMemo(
    () => attendanceRecords.filter((r) => r.scheduleId === selectedScheduleId && r.date === dateStr),
    [selectedScheduleId, dateStr],
  );

  const marks = useMemo(() => {
    const m: Record<string, AttendanceStatus> = {};
    for (const a of groupAthletes) {
      m[a.id] = overrides[a.id] ?? existingRecords.find((r) => r.athleteId === a.id)?.status ?? "present";
    }
    return m;
  }, [groupAthletes, existingRecords, overrides]);

  /* ─── Admin Heatmap ─── */
  const [viewMode, setViewMode] = useState<ViewMode>("groups");
  const [filterDateStart, setFilterDateStart] = useState("01.05.2026");
  const [filterDateEnd, setFilterDateEnd] = useState("30.06.2026");
  const [filterDiscipline, setFilterDiscipline] = useState<string>("Все");
  const [filterCoach, setFilterCoach] = useState<string>("Все");
  const [filterGroup, setFilterGroup] = useState<string>("Все");

  const uniqueCoaches = [...new Set(schedules.map((s) => s.coachName))];
  const uniqueGroups = [...new Set(schedules.map((s) => s.groupId))];

  const filteredSchedules = useMemo(() => {
    let list = schedules;
    if (filterDiscipline !== "Все") list = list.filter((s) => s.discipline === filterDiscipline);
    if (filterCoach !== "Все") list = list.filter((s) => s.coachName === filterCoach);
    if (filterGroup !== "Все") list = list.filter((s) => s.groupId === filterGroup);
    return list;
  }, [filterDiscipline, filterCoach, filterGroup]);

  const heatmapData = useMemo(() => {
    const filteredIds = new Set(filteredSchedules.map((s) => s.id));

    const rows = viewMode === "groups"
      ? [...new Set(filteredSchedules.map((s) => s.groupId))]
      : [...new Set(filteredSchedules.map((s) => s.coachName))];

    return rows.map((label) => {
      const rowSchedules = viewMode === "groups"
        ? filteredSchedules.filter((s) => s.groupId === label)
        : filteredSchedules.filter((s) => s.coachName === label);

      const days = dayNames.map((_, di) => {
        const dow = di + 1;
        const daySchedules = rowSchedules.filter((s) => s.dayOfWeek === dow);
        if (daySchedules.length === 0) return { label: dayNames[di], pct: null };

        const dayIds = new Set(daySchedules.map((s) => s.id));
        const records = attendanceRecords.filter(
          (r) => dayIds.has(r.scheduleId) && r.date >= filterDateStart && r.date <= filterDateEnd,
        );
        const total = records.length;
        const present = records.filter((r) => r.status === "present").length;
        return { label: dayNames[di], pct: total > 0 ? Math.round((present / total) * 100) : null };
      });

      return { label, days, discipline: rowSchedules[0]?.discipline ?? "" };
    });
  }, [viewMode, filteredSchedules, filterDateStart, filterDateEnd]);

  const heatColor = (pct: number | null) => {
    if (pct === null) return "bg-muted/30";
    if (pct >= 90) return "bg-[color:var(--success)]/25 text-[color:var(--success)]";
    if (pct >= 75) return "bg-[color:var(--success)]/15 text-[color:var(--success)]";
    if (pct >= 60) return "bg-accent/20 text-accent-foreground";
    if (pct >= 40) return "bg-destructive/15 text-destructive";
    return "bg-destructive/25 text-destructive";
  };

  /* ─── Shared ─── */

  const switchSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setDirty(false);
    setOverrides({});
  };

  const handleMark = (athleteId: string, status: AttendanceStatus) => {
    setOverrides((prev) => ({ ...prev, [athleteId]: status }));
    setDirty(true);
  };

  const handleSave = () => {
    for (const a of groupAthletes) {
      const status = marks[a.id];
      const existing = existingRecords.find((r) => r.athleteId === a.id);
      if (existing) {
        existing.status = status;
      } else {
        attendanceRecords.push({
          id: freshAttendanceId(),
          scheduleId: selectedScheduleId,
          date: dateStr,
          athleteId: a.id,
          athleteName: a.name,
          status,
          markedByCoachId: user?.id ?? "",
        });
      }
    }
    persistAttendanceRecords();
    setDirty(false);
    setOverrides({});
  };

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
    setDirty(false);
    setOverrides({});
  };

  const goNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
    setDirty(false);
    setOverrides({});
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
              {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
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
              {uniqueCoaches.map((c) => <option key={c} value={c}>{c}</option>)}
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
              {uniqueGroups.map((g) => <option key={g} value={g}>{getGroupName(g)}</option>)}
            </select>
          </div>
        </div>

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
                      <span className="font-medium text-secondary">{viewMode === "groups" ? getGroupName(row.label) : row.label}</span>
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

  return (
    <AppShell title="Посещаемость" subtitle="Журнал отметок">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Журнал посещаемости</h2>
          <p className="text-sm text-muted-foreground">
            {daySchedules.length} занятий в расписании · {groupAthletes.length} спортсменов
          </p>
        </div>
        {dirty && (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Сохранить
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-[var(--shadow-card)]">
          {!selectedSchedule ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Нет занятий в расписании
            </div>
          ) : (
            <>
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-secondary">{getGroupName(selectedSchedule.groupId)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSchedule.discipline} · {selectedSchedule.timeStart}–{selectedSchedule.timeEnd} · {selectedSchedule.room}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                    {dateStr}
                  </Badge>
                </div>

                {/* Date navigator */}
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={goPrevDay}>
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
                        onSelect={(d) => { if (d) { setSelectedDate(d); setDirty(false); setOverrides({}); } }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={goNextDay}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
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
                    {groupAthletes.map((a, i) => (
                      <tr key={a.id} className="transition hover:bg-muted/20">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-primary-foreground">
                              {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="font-medium text-secondary">{a.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{a.rank}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`font-normal ${statusColors[marks[a.id] ?? "present"]}`}>
                            {statusLabels[marks[a.id] ?? "present"]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {(["present", "absent", "excused"] as AttendanceStatus[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleMark(a.id, s)}
                                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                                  marks[a.id] === s
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
                    ))}
                    {groupAthletes.length === 0 && (
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
              {daySchedules.map((s) => {
                const isSelected = s.id === selectedScheduleId;
                const recordsOnDate = attendanceRecords.filter(
                  (r) => r.scheduleId === s.id && r.date === dateStr,
                );
                const athleteCount = athleteCountBySchedule[s.id] ?? 0;
                const markedAll = recordsOnDate.length > 0 && recordsOnDate.length >= athleteCount;
                const markedPartial = recordsOnDate.length > 0 && recordsOnDate.length < athleteCount;
                const markBorder = !isSelected
                  ? markedAll ? "border-l-green-500"
                    : markedPartial ? "border-l-yellow-500"
                    : ""
                  : "";
                return (
                  <button
                    key={s.id}
                    onClick={() => switchSchedule(s.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : `border-border hover:border-primary/30 hover:bg-muted/30 ${markBorder}`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isSelected ? "text-primary" : "text-secondary"}`}>
                        {getGroupName(s.groupId)}
                      </span>
                      {recordsOnDate.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {recordsOnDate.filter((r) => r.status === "present").length}/{recordsOnDate.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {dayNames[s.dayOfWeek - 1]} · {s.timeStart}–{s.timeEnd}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{s.room}</div>
                  </button>
                );
              })}
              {daySchedules.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Нет занятий</p>
              )}
            </div>
          </Card>

          {selectedSchedule && (
            <Card className="shadow-[var(--shadow-card)]">
              <div className="border-b border-border px-5 py-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-secondary">
                  <ClipboardList className="h-4 w-4" /> Статистика
                </h4>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Присутствует</span>
                  <span className="font-medium text-[color:var(--success)]">
                    {Object.values(marks).filter((s) => s === "present").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Отсутствует</span>
                  <span className="font-medium text-destructive">
                    {Object.values(marks).filter((s) => s === "absent").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Уважительная</span>
                  <span className="font-medium text-muted-foreground">
                    {Object.values(marks).filter((s) => s === "excused").length}
                  </span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex items-center justify-between font-medium text-secondary">
                    <span>Посещаемость</span>
                    <span className="font-display text-lg font-bold text-primary">
                      {groupAthletes.length > 0
                        ? Math.round(
                            (Object.values(marks).filter((s) => s !== "absent").length / groupAthletes.length) * 100,
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