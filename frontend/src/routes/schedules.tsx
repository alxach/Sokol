import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Clock, MapPin, Edit3, Check, ArrowLeft, X, CalendarDays, AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { useCenter } from "@/lib/center";
import {
  schedules as allSchedules,
  schedulePeriods as allPeriods,
  groups as allGroups,
  getCenterIdByCoachName,
  getPeriodStatus,
  archiveOtherActivePeriods,
  freshSchedulePeriodId,
  freshScheduleId,
  persistSchedulePeriods,
  persistSchedules,
  type SchedulePeriod,
  type Schedule,
  type Discipline,
} from "@/lib/mock-data";

export const Route = createFileRoute("/schedules")({
  head: () => ({
    meta: [
      { title: "Расписание — СОКОЛ" },
      { name: "description", content: "Расписание тренировок." },
    ],
  }),
  component: SchedulesPage,
});

const dayNames = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const dayNamesShort = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function SchedulesPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach, isDirector } = useAuth();
  const { selectedCenterId } = useCenter();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [showEditPeriod, setShowEditPeriod] = useState<string | null>(null);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("Все");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate((n) => n + 1);

  const userGroups = useMemo(() => {
    if (!user) return [];
    if (isCoach) return allGroups.filter((g) => g.coachId === user.id);
    if (isDirector && selectedCenterId) return allGroups.filter((g) => getCenterIdByCoachName(g.coachName) === selectedCenterId);
    return allGroups;
  }, [isCoach, isDirector, selectedCenterId, user]);

  const visiblePeriods = useMemo(() => {
    let periods = allPeriods.filter((p) => {
      if (selectedGroup !== "Все" && p.group !== selectedGroup) return false;
      if (isCoach && p.coachId !== user?.id) return false;
      if (isDirector && selectedCenterId && getCenterIdByCoachName(p.coachName) !== selectedCenterId) return false;
      return true;
    });
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    periods = periods.filter((p) => {
      const effectiveStatus = getPeriodStatus(p);
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return effectiveStatus === "active";
      if (statusFilter === "draft") return effectiveStatus === "draft";
      if (statusFilter === "archived") return effectiveStatus === "archived";
      return true;
    });
    return periods;
  }, [isCoach, isDirector, selectedCenterId, user, selectedGroup, statusFilter]);

  const selectedPeriod = useMemo(
    () => allPeriods.find((p) => p.id === selectedPeriodId) ?? null,
    [selectedPeriodId],
  );

  const periodSchedules = useMemo(
    () => (selectedPeriod ? allSchedules.filter((s) => s.periodId === selectedPeriod.id) : []),
    [selectedPeriod],
  );

  const crossSchedules = useMemo(() => {
    const ids = new Set(visiblePeriods.map((p) => p.id));
    return allSchedules.filter((s) => ids.has(s.periodId));
  }, [visiblePeriods]);

  const crossGroupedByDay = useMemo(() => {
    const map = new Map<number, Schedule[]>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const s of crossSchedules) {
      map.get(s.dayOfWeek)?.push(s);
    }
    return map;
  }, [crossSchedules]);

  const canEdit = (period: SchedulePeriod) => {
    return isCoach && period.coachId === user?.id && getPeriodStatus(period) === "draft";
  };

  const handleDeletePeriod = (periodId: string) => {
    const idx = allPeriods.findIndex((p) => p.id === periodId);
    if (idx !== -1) allPeriods.splice(idx, 1);
    const toRemove = allSchedules.filter((s) => s.periodId === periodId);
    for (const s of toRemove) {
      const sidx = allSchedules.findIndex((x) => x.id === s.id);
      if (sidx !== -1) allSchedules.splice(sidx, 1);
    }
    persistSchedulePeriods();
    persistSchedules();
    if (selectedPeriodId === periodId) setSelectedPeriodId(null);
    rerender();
  };

  const handleApprovePeriod = (periodId: string) => {
    const period = allPeriods.find((p) => p.id === periodId);
    if (period) {
      archiveOtherActivePeriods(period);
      period.status = "active";
      persistSchedulePeriods();
      rerender();
    }
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    const idx = allSchedules.findIndex((s) => s.id === scheduleId);
    if (idx !== -1) allSchedules.splice(idx, 1);
    persistSchedules();
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
    <AppShell title="Расписание" subtitle="Расписание тренировок и занятий">
      {selectedPeriod ? (
        <PeriodDetailView
          period={selectedPeriod}
          schedules={periodSchedules}
          canEdit={canEdit(selectedPeriod)}
          onBack={() => setSelectedPeriodId(null)}
          onApprove={() => handleApprovePeriod(selectedPeriod.id)}
          onAddSchedule={() => setShowAddSchedule(true)}
          onEditSchedule={(id) => setShowEditSchedule(id)}
          onDeleteSchedule={handleDeleteSchedule}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-secondary">
                {isCoach ? "Моё расписание" : "Расписание"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {visiblePeriods.length} периодов
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="Все">Все группы</option>
                {userGroups.map((g) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="draft">Черновики</option>
                <option value="archived">Архив</option>
              </select>
              {isCoach && (
                <Button onClick={() => setShowCreatePeriod(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" /> Создать период
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visiblePeriods.map((p) => {
              const effectiveStatus = getPeriodStatus(p);
              const schedCount = allSchedules.filter((s) => s.periodId === p.id).length;
              return (
                <Card
                  key={p.id}
                  className="cursor-pointer border-2 p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40"
                  onClick={() => setSelectedPeriodId(p.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold text-secondary">{p.group}</h3>
                      <p className="text-xs text-muted-foreground">{p.coachName}</p>
                    </div>
                    <StatusBadge status={effectiveStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {p.periodStart} — {p.periodEnd}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {schedCount} занятий
                    </span>
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                      {p.discipline}
                    </Badge>
                  </div>
                  {canEdit(p) && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); setShowEditPeriod(p.id); }}
                      >
                        <Edit3 className="mr-1 h-3 w-3" /> Изменить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); handleDeletePeriod(p.id); }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Удалить
                      </Button>
                    </div>
                  )}
                  {effectiveStatus === "draft" && isCoach && p.coachId === user?.id && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        className="h-7 w-full text-xs bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90"
                        onClick={(e) => { e.stopPropagation(); handleApprovePeriod(p.id); }}
                      >
                        <Check className="mr-1 h-3 w-3" /> Утвердить
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
            {visiblePeriods.length === 0 && (
              <div className="col-span-full flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
                {isCoach ? "Нет периодов расписания. Создайте первый." : "Нет периодов"}
              </div>
            )}
          </div>

          {crossSchedules.length > 0 && (
            <section className="mt-8">
              <h3 className="mb-4 font-display text-lg font-bold text-secondary">Неделя</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const daySchedules = crossGroupedByDay.get(day) ?? [];
                  return (
                    <Card key={day} className="border border-border shadow-[var(--shadow-card)]">
                      <div className="border-b border-border bg-muted/20 px-4 py-2.5">
                        <h3 className="text-sm font-bold text-secondary">{dayNames[day - 1]}</h3>
                        <p className="text-xs text-muted-foreground">{daySchedules.length} занятий</p>
                      </div>
                      <div className="space-y-2 p-3">
                        {daySchedules.length === 0 && (
                          <p className="py-4 text-center text-xs text-muted-foreground">Нет занятий</p>
                        )}
                        {daySchedules.map((s) => (
                          <div key={s.id} className="rounded-lg border border-border bg-card p-3">
                            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="font-medium text-foreground">{s.timeStart}</span>
                              <span>–</span>
                              <span className="font-medium text-foreground">{s.timeEnd}</span>
                            </div>
                            <p className="text-sm font-medium text-secondary">{s.group}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {s.room}
                              </span>
                              <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                                {s.discipline}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {showCreatePeriod && (
        <CreatePeriodModal
          userGroups={userGroups}
          coachId={user?.id ?? ""}
          coachName={user?.coachName ?? ""}
          onClose={() => setShowCreatePeriod(false)}
          onSaved={() => { persistSchedulePeriods(); persistSchedules(); rerender(); }}
        />
      )}
      {showEditPeriod && (
        <EditPeriodModal
          period={allPeriods.find((p) => p.id === showEditPeriod)!}
          onClose={() => setShowEditPeriod(null)}
          onSaved={() => { persistSchedulePeriods(); rerender(); }}
        />
      )}
      {showAddSchedule && selectedPeriod && (
        <ScheduleFormModal
          period={selectedPeriod}
          editScheduleId={null}
          onClose={() => setShowAddSchedule(false)}
          onSaved={() => { persistSchedules(); rerender(); }}
        />
      )}
      {showEditSchedule && selectedPeriod && (
        <ScheduleFormModal
          period={selectedPeriod}
          editScheduleId={showEditSchedule}
          onClose={() => setShowEditSchedule(null)}
          onSaved={() => { persistSchedules(); rerender(); }}
        />
      )}
    </AppShell>
  );
}

function PeriodDetailView({
  period,
  schedules,
  canEdit: editable,
  onBack,
  onApprove,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
}: {
  period: SchedulePeriod;
  schedules: Schedule[];
  canEdit: boolean;
  onBack: () => void;
  onApprove: () => void;
  onAddSchedule: () => void;
  onEditSchedule: (id: string) => void;
  onDeleteSchedule: (id: string) => void;
}) {
  const effectiveStatus = getPeriodStatus(period);

  const groupedByDay = useMemo(() => {
    const map = new Map<number, Schedule[]>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const s of schedules) {
      map.get(s.dayOfWeek)?.push(s);
    }
    return map;
  }, [schedules]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-secondary">{period.group}</h2>
              <StatusBadge status={effectiveStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {period.periodStart} — {period.periodEnd} · {schedules.length} занятий
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {effectiveStatus === "draft" && editable && (
            <Button onClick={onApprove} className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90">
              <Check className="mr-2 h-4 w-4" /> Утвердить
            </Button>
          )}
          {editable && (
            <Button onClick={onAddSchedule} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Добавить занятие
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const daySchedules = groupedByDay.get(day) ?? [];
          return (
            <Card key={day} className="border border-border shadow-[var(--shadow-card)]">
              <div className="border-b border-border bg-muted/20 px-4 py-2.5">
                <h3 className="text-sm font-bold text-secondary">{dayNames[day - 1]}</h3>
                <p className="text-xs text-muted-foreground">{daySchedules.length} занятий</p>
              </div>
              <div className="space-y-2 p-3">
                {daySchedules.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Нет занятий</p>
                )}
                {daySchedules.map((s) => (
                  <div key={s.id} className="group relative rounded-lg border border-border bg-card p-3 transition hover:border-primary/30">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium text-foreground">{s.timeStart}</span>
                      <span>–</span>
                      <span className="font-medium text-foreground">{s.timeEnd}</span>
                    </div>
                    <p className="text-sm font-medium text-secondary">{s.group}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.room}
                      </span>
                    </div>
                    {editable && (
                      <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex">
                        <button
                          onClick={() => onEditSchedule(s.id)}
                          className="rounded-md p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                          title="Редактировать"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteSchedule(s.id)}
                          className="rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    active: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    archived: "bg-muted text-muted-foreground border-border opacity-60",
  };
  const labels: Record<string, string> = {
    draft: "Черновик",
    active: "Активный",
    archived: "Архив",
  };
  return (
    <Badge variant="outline" className={`font-normal ${styles[status] ?? styles.draft}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

function CreatePeriodModal({
  userGroups,
  coachId,
  coachName,
  onClose,
  onSaved,
}: {
  userGroups: typeof allGroups;
  coachId: string;
  coachName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const DEFAULT_SLOT = { start: "09:00", end: "10:30", room: "" };
  const [groupId, setGroupId] = useState(userGroups[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dayTimes, setDayTimes] = useState<Record<number, { start: string; end: string; room: string }>>({});
  const [defaultRoom, setDefaultRoom] = useState("");

  const selectedGroup = userGroups.find((g) => g.id === groupId);
  const days = Object.keys(dayTimes).map(Number);

  const toggleDay = (day: number) => {
    setDayTimes((prev) => {
      if (prev[day]) {
        const { [day]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [day]: { ...DEFAULT_SLOT, room: defaultRoom } };
    });
  };

  const handleCreate = () => {
    if (!periodStart || !periodEnd || days.length === 0 || !selectedGroup) return;
    const periodId = freshSchedulePeriodId();
    const period: SchedulePeriod = {
      id: periodId,
      coachId,
      coachName,
      group: selectedGroup.name,
      discipline: selectedGroup.discipline,
      periodStart,
      periodEnd,
      status: "draft",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    allPeriods.push(period);
    for (const day of days) {
      const t = dayTimes[day];
      allSchedules.push({
        id: freshScheduleId(),
        periodId,
        coachId,
        coachName,
        group: selectedGroup.name,
        discipline: selectedGroup.discipline,
        dayOfWeek: day,
        timeStart: t.start,
        timeEnd: t.end,
        room: t.room || "Не указано",
      });
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Новый период расписания</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
          <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа *</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {userGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name} · {g.discipline}</option>
              ))}
            </select>
            {(() => {
              const selected = userGroups.find((g) => g.id === groupId);
              const hasActive = selected && allPeriods.some(
                (p) => p.group === selected.name && p.id !== "new" && getPeriodStatus(p) === "active",
              );
              return hasActive ? (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 p-2.5 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
                  <span>У группы уже есть активный период. При утверждении нового, старый будет перемещён в архив.</span>
                </div>
              ) : null;
            })()}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата начала *</label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-9" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата окончания *</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-9" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Дни недели *</label>
            <div className="flex flex-wrap gap-1.5">
              {dayNamesShort.map((name, idx) => {
                const dayNum = idx + 1;
                const active = dayNum in dayTimes;
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDay(dayNum)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Выбрано {days.length} {days.length === 1 ? "день" : days.length < 5 ? "дня" : "дней"}
            </p>
            {days.length > 0 && (
              <div className="mt-3 space-y-2">
                {Object.entries(dayTimes)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([day, slot]) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-7 text-xs font-medium text-muted-foreground">
                        {dayNamesShort[Number(day) - 1]}
                      </span>
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={(e) =>
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...prev[Number(day)], start: e.target.value },
                          }))
                        }
                        className="h-8 w-[100px]"
                      />
                      <span className="text-xs text-muted-foreground">—</span>
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={(e) =>
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...prev[Number(day)], end: e.target.value },
                          }))
                        }
                        className="h-8 w-[100px]"
                      />
                      <Input
                        value={slot.room}
                        onChange={(e) =>
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...prev[Number(day)], room: e.target.value },
                          }))
                        }
                        placeholder="Зал"
                        className="h-8 w-[90px]"
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Зал / место</label>
            <Input
              value={defaultRoom}
              onChange={(e) => setDefaultRoom(e.target.value)}
              placeholder="Зал А, спортзал…"
              className="h-9"
            />
          </div>
          <p className="text-[10px] text-muted-foreground -mt-3">
            Новым дням присваивается зал из поля выше. Можно изменить для каждого дня отдельно.
          </p>
          <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Создать период
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditPeriodModal({
  period,
  onClose,
  onSaved,
}: {
  period: SchedulePeriod;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [periodStart, setPeriodStart] = useState(period.periodStart);
  const [periodEnd, setPeriodEnd] = useState(period.periodEnd);

  const handleSave = () => {
    if (!periodStart || !periodEnd) return;
    period.periodStart = periodStart;
    period.periodEnd = periodEnd;
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Редактировать период</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата начала</label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-9" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата окончания</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>Группа: <strong>{period.group}</strong></p>
            <p>Дисциплина: <strong>{period.discipline}</strong></p>
            <p>Статус: <strong>{period.status}</strong></p>
          </div>
          <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduleFormModal({
  period,
  editScheduleId,
  onClose,
  onSaved,
}: {
  period: SchedulePeriod;
  editScheduleId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editScheduleId ? allSchedules.find((s) => s.id === editScheduleId) : null;

  const [dayOfWeek, setDayOfWeek] = useState(existing?.dayOfWeek ?? 1);
  const [timeStart, setTimeStart] = useState(existing?.timeStart ?? "09:00");
  const [timeEnd, setTimeEnd] = useState(existing?.timeEnd ?? "10:30");
  const [room, setRoom] = useState(existing?.room ?? "");

  const handleSave = () => {
    if (existing) {
      existing.dayOfWeek = dayOfWeek;
      existing.timeStart = timeStart;
      existing.timeEnd = timeEnd;
      existing.room = room || "Не указано";
    } else {
      allSchedules.push({
        id: freshScheduleId(),
        periodId: period.id,
        coachId: period.coachId,
        coachName: period.coachName,
        group: period.group,
        discipline: period.discipline,
        dayOfWeek,
        timeStart,
        timeEnd,
        room: room || "Не указано",
      });
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">
            {editScheduleId ? "Редактировать занятие" : "Новое занятие"}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">День недели *</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {dayNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Начало *</label>
              <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="h-9" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Конец *</label>
              <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="h-9" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Зал</label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Зал А, спортзал…" className="h-9" />
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>Группа: <strong>{period.group}</strong></p>
            <p>Период: {period.periodStart} — {period.periodEnd}</p>
          </div>
          <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {editScheduleId ? "Сохранить" : "Добавить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
