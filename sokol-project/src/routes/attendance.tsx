import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Save, Calendar } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard, useAuth } from "@/lib/auth";
import {
  schedules,
  athletes,
  attendanceRecords,
  type AttendanceStatus,
  type Schedule,
} from "@/lib/mock-data";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Посещаемость — СОКОЛ" },
      { name: "description", content: "Журнал посещаемости занятий. Отметка спортсменов." },
    ],
  }),
  component: AttendancePage,
});

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

const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function AttendancePage() {
  const { loading, user } = useAuthGuard();
  const { isCoach, isAdmin } = useAuth();
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(schedules[0]?.id ?? "");
  const [dirty, setDirty] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus>>({});

  const coachSchedules = useMemo(
    () => (isCoach && user ? schedules.filter((s) => s.coachId === user.id) : schedules),
    [isCoach, user],
  );

  const selectedSchedule = useMemo(
    () => coachSchedules.find((s) => s.id === selectedScheduleId),
    [coachSchedules, selectedScheduleId],
  );

  const groupAthletes = useMemo(() => {
    if (!selectedSchedule) return [];
    const coachName = selectedSchedule.coachName;
    return athletes.filter((a) => a.coach === coachName);
  }, [selectedSchedule]);

  const today = "02.06.2026";

  const existingToday = useMemo(
    () => attendanceRecords.filter((r) => r.scheduleId === selectedScheduleId && r.date === today),
    [selectedScheduleId],
  );

  const marks = useMemo(() => {
    const m: Record<string, AttendanceStatus> = {};
    for (const a of groupAthletes) {
      m[a.id] = overrides[a.id] ?? existingToday.find((r) => r.athleteId === a.id)?.status ?? "present";
    }
    return m;
  }, [groupAthletes, existingToday, overrides]);

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
    setDirty(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Посещаемость" subtitle="Журнал отметок">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Журнал посещаемости</h2>
          <p className="text-sm text-muted-foreground">
            {coachSchedules.length} занятий в расписании · {groupAthletes.length} спортсменов
          </p>
        </div>
        {dirty && isCoach && (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Сохранить
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main: roster */}
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
                    <h3 className="font-display text-lg font-bold text-secondary">{selectedSchedule.group}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSchedule.discipline} · {selectedSchedule.timeStart}–{selectedSchedule.timeEnd} · {selectedSchedule.room}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                    {today}
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
                      {isCoach && <th className="px-4 py-3 font-medium">Отметка</th>}
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
                            {marks[a.id] === "late" ? `${statusLabels[marks[a.id]]} (${10} мин)` : statusLabels[marks[a.id] ?? "present"]}
                          </Badge>
                        </td>
                        {isCoach && (
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
                                  {s === "present" ? "✅" : s === "absent" ? "❌" : "📄"}
                                </button>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {groupAthletes.length === 0 && (
                      <tr>
                        <td colSpan={isCoach ? 5 : 4} className="py-12 text-center text-sm text-muted-foreground">
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

        {/* Sidebar: schedule picker */}
        <div className="space-y-4">
          <Card className="shadow-[var(--shadow-card)]">
            <div className="border-b border-border px-5 py-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-secondary">
                <Calendar className="h-4 w-4" /> Расписание
              </h4>
            </div>
            <div className="space-y-1 p-3">
              {coachSchedules.map((s) => {
                const isSelected = s.id === selectedScheduleId;
                const recordsToday = attendanceRecords.filter(
                  (r) => r.scheduleId === s.id && r.date === today,
                );
                return (
                  <button
                    key={s.id}
                    onClick={() => switchSchedule(s.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isSelected ? "text-primary" : "text-secondary"}`}>
                        {s.group}
                      </span>
                      {recordsToday.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {recordsToday.filter((r) => r.status === "present").length}/{recordsToday.length}
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
              {coachSchedules.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Нет занятий</p>
              )}
            </div>
          </Card>

          {/* Stats */}
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
