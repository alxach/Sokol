import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Clock, Edit3, Check, ArrowLeft, X, CalendarDays, ChevronDown, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  getGroupName,
  archiveOtherActivePeriods,
  duplicatePeriod,
  dateOverlapsPeriods,
  getCoachVacationPeriods,
  freshScheduleId,
  persistSchedulePeriods,
  persistSchedules,
  type SchedulePeriod,
  type Schedule,
  type VacationPeriod,
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
  const [showEditPeriod, setShowEditPeriod] = useState<string | null>(null);
  const [addScheduleDay, setAddScheduleDay] = useState<number | null>(null);
  const [showEditSchedule, setShowEditSchedule] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("Все");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCrossSchedule, setShowCrossSchedule] = useState(false);
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
      if (selectedGroup !== "Все" && p.groupId !== selectedGroup) return false;
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
    return isCoach && period.coachId === user?.id && getPeriodStatus(period) !== "archived";
  };

  const handleDeletePeriod = (periodId: string) => {
    const period = allPeriods.find((p) => p.id === periodId);
    if (period) {
      period.status = "archived";
      persistSchedulePeriods();
      if (selectedPeriodId === periodId) setSelectedPeriodId(null);
      rerender();
      toast.success("Период перемещён в архив");
    }
  };

  const handleApprovePeriod = (periodId: string) => {
    const period = allPeriods.find((p) => p.id === periodId);
    if (period) {
      archiveOtherActivePeriods(period);
      period.status = "active";
      persistSchedulePeriods();
      rerender();
      toast.success("Расписание утверждено");
    }
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    const idx = allSchedules.findIndex((s) => s.id === scheduleId);
    if (idx !== -1) allSchedules.splice(idx, 1);
    persistSchedules();
    rerender();
    toast.success("Занятие удалено");
  };

  const handleDuplicatePeriod = (periodId: string) => {
    const newPeriod = duplicatePeriod(periodId);
    if (newPeriod) {
      persistSchedulePeriods();
      persistSchedules();
      rerender();
      toast.success(`Создан период ${newPeriod.periodStart} — ${newPeriod.periodEnd}`);
      setSelectedPeriodId(newPeriod.id);
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
    <AppShell title="Расписание" subtitle="Расписание тренировок и занятий">
      {selectedPeriod ? (
        <PeriodDetailView
          period={selectedPeriod}
          schedules={periodSchedules}
          canEdit={canEdit(selectedPeriod)}
          periodStatus={getPeriodStatus(selectedPeriod)}
          onBack={() => setSelectedPeriodId(null)}
          onApprove={() => handleApprovePeriod(selectedPeriod.id)}
          onEditPeriod={() => setShowEditPeriod(selectedPeriod.id)}
          onDeletePeriod={() => handleDeletePeriod(selectedPeriod.id)}
          onDuplicatePeriod={() => handleDuplicatePeriod(selectedPeriod.id)}
          onAddSchedule={(day) => setAddScheduleDay(day ?? -1)}
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
                  <option key={g.id} value={g.id}>{g.name}</option>
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

            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visiblePeriods.map((p) => {
              const effectiveStatus = getPeriodStatus(p);
              const schedCount = allSchedules.filter((s) => s.periodId === p.id).length;
              return (
                <Card
                  key={p.id}
                  className="group cursor-pointer border border-border p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40 hover:shadow-md"
                  onClick={() => setSelectedPeriodId(p.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                          effectiveStatus === "active" ? "bg-[color:var(--success)]"
                          : effectiveStatus === "draft" ? "bg-muted-foreground"
                          : "bg-border"
                        }`} />
                        <h3 className="truncate font-display text-base font-bold text-secondary">{getGroupName(p.groupId)}</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.coachName}</p>
                    </div>
                    <StatusBadge status={effectiveStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {p.periodStart} — {p.periodEnd}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {schedCount} {schedCount === 1 ? "занятие" : schedCount < 5 ? "занятия" : "занятий"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                      {p.discipline}
                    </Badge>
                  </div>

                  {effectiveStatus === "draft" && isCoach && p.coachId === user?.id && (
                    <div className="mt-3">
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
              <button
                onClick={() => setShowCrossSchedule(!showCrossSchedule)}
                className="mb-4 flex items-center gap-2 text-left font-display text-lg font-bold text-secondary transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showCrossSchedule ? "rotate-0" : "-rotate-90"}`} />
                Сводка на неделю
              </button>
              {showCrossSchedule && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const daySchedules = crossGroupedByDay.get(day) ?? [];
                    const isToday = new Date().getDay() === day || (day === 7 && new Date().getDay() === 0);
                    return (
                      <Card key={day} className={`border shadow-[var(--shadow-card)] ${
                        isToday ? "border-primary/40 bg-primary/[0.02]" : "border-border"
                      }`}>
                        <div className={`border-b px-4 py-2.5 ${
                          isToday ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20"
                        }`}>
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-secondary">{dayNames[day - 1]}</h3>
                            {isToday && (
                              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Сегодня</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{daySchedules.length} занятий</p>
                        </div>
                        <div className="space-y-1.5 p-2.5">
                          {daySchedules.length === 0 && (
                            <p className="py-4 text-center text-xs text-muted-foreground">Нет занятий</p>
                          )}
                          {daySchedules.map((s) => (
                            <div key={s.id} className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs transition hover:border-primary/30">
                              <div className="flex items-center gap-2 font-medium text-foreground">
                                <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span>{s.timeStart} – {s.timeEnd}</span>
                              </div>
                              <p className="mt-0.5 text-sm font-medium text-secondary">{getGroupName(s.groupId)}</p>
                              <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                                <span className="flex items-center gap-0.5">{s.room}</span>
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
              )}
            </section>
          )}
        </>
      )}

      {showEditPeriod && (
        <EditPeriodModal
          period={allPeriods.find((p) => p.id === showEditPeriod)!}
          onClose={() => setShowEditPeriod(null)}
          onSaved={() => { persistSchedulePeriods(); rerender(); }}
        />
      )}
      {addScheduleDay !== null && selectedPeriod && (
        <ScheduleFormModal
          period={selectedPeriod}
          editScheduleId={null}
          presetDay={addScheduleDay !== -1 ? addScheduleDay : null}
          onClose={() => setAddScheduleDay(null)}
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
  periodStatus,
  onBack,
  onApprove,
  onEditPeriod,
  onDeletePeriod,
  onDuplicatePeriod,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
}: {
  period: SchedulePeriod;
  schedules: Schedule[];
  canEdit: boolean;
  periodStatus: string;
  onBack: () => void;
  onApprove: () => void;
  onEditPeriod: () => void;
  onDeletePeriod: () => void;
  onDuplicatePeriod: () => void;
  onAddSchedule: (day?: number) => void;
  onEditSchedule: (id: string) => void;
  onDeleteSchedule: (id: string) => void;
}) {
  const isActive = periodStatus === "active";
  const [pendingConfirm, setPendingConfirm] = useState<(() => void) | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const coachOffDays = useMemo(() => {
    const { vacations, sickLeaves } = getCoachVacationPeriods(period.coachId);
    const result = new Map<number, { type: "vacation" | "sick"; label: string }>();
    for (let day = 1; day <= 7; day++) {
      const start = new Date(period.periodStart + "T00:00:00");
      const end = new Date(period.periodEnd + "T00:00:00");
      const dayOffsets: number[] = [];
      const d = new Date(start);
      while (d <= end) {
        const jsDay = d.getDay();
        const mapped = jsDay === 0 ? 7 : jsDay;
        if (mapped === day) dayOffsets.push(Math.floor((d.getTime() - start.getTime()) / 86400000));
        d.setDate(d.getDate() + 1);
      }
      for (const offset of dayOffsets) {
        const checkDate = new Date(start);
        checkDate.setDate(checkDate.getDate() + offset);
        if (dateOverlapsPeriods(checkDate, vacations)) {
          result.set(day, { type: "vacation", label: "Отпуск" });
          break;
        }
        if (dateOverlapsPeriods(checkDate, sickLeaves)) {
          result.set(day, { type: "sick", label: "Больничный" });
          break;
        }
      }
    }
    return result;
  }, [period]);

  const groupedByDay = useMemo(() => {
    const map = new Map<number, Schedule[]>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const s of schedules) {
      map.get(s.dayOfWeek)?.push(s);
    }
    return map;
  }, [schedules]);

  const handleAction = (action: () => void, requireConfirm: boolean = false) => {
    if (isActive || requireConfirm) {
      setPendingConfirm(() => action);
    } else {
      action();
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-secondary">{getGroupName(period.groupId)}</h2>
              <StatusBadge status={periodStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {period.periodStart} — {period.periodEnd} · {schedules.length} занятий
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {periodStatus === "draft" && editable && (
            <Button onClick={onApprove} className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90">
              <Check className="mr-2 h-4 w-4" /> Утвердить
            </Button>
          )}
          {editable && (
            <>
              <Button variant="outline" size="sm" onClick={onDuplicatePeriod} className="h-8 text-xs">
                <Copy className="mr-1 h-3 w-3" /> Дублировать
              </Button>
              <Button variant="outline" size="sm" onClick={onEditPeriod} className="h-8 text-xs">
                <Edit3 className="mr-1 h-3 w-3" /> Изменить период
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                <Trash2 className="mr-1 h-3 w-3" /> Удалить
              </Button>
            </>
          )}
          {editable && (
            <Button onClick={() => handleAction(onAddSchedule)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Добавить занятие
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const daySchedules = groupedByDay.get(day) ?? [];
          const isToday = new Date().getDay() === day || (day === 7 && new Date().getDay() === 0);
          return (
            <Card key={day} className={`border shadow-[var(--shadow-card)] ${
              isToday ? "border-primary/40 bg-primary/[0.02]" : "border-border"
            }`}>
              <div className={`border-b px-4 py-2.5 ${
                isToday ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20"
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-secondary">{dayNames[day - 1]}</h3>
                  <div className="flex items-center gap-1.5">
                    {coachOffDays.get(day) && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        coachOffDays.get(day)!.type === "vacation"
                          ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
                          : "bg-destructive/10 text-destructive"
                      }`}>
                        {coachOffDays.get(day)!.label}
                      </span>
                    )}
                    {isToday && (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Сегодня</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{daySchedules.length} занятий</p>
              </div>
              <div className="space-y-1.5 p-2.5">
                {daySchedules.length === 0 && (
                  editable ? (
                    <button
                      onClick={() => handleAction(() => onAddSchedule(day))}
                      className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Добавить
                    </button>
                  ) : (
                    <p className="py-4 text-center text-xs text-muted-foreground">Нет занятий</p>
                  )
                )}
                {daySchedules.map((s) => (
                  <div key={s.id} className="group rounded-lg border border-border bg-card p-2.5 text-xs transition hover:border-primary/30">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="font-medium text-foreground">{s.timeStart} – {s.timeEnd}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-secondary">{getGroupName(s.groupId)}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      <span className="flex items-center gap-0.5">{s.room}</span>
                    </div>
                    {editable && (
                      <div className="mt-1.5 flex flex-col gap-0.5 opacity-60 transition-all group-hover:opacity-100">
                        <button
                          onClick={() => handleAction(() => onEditSchedule(s.id))}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          title="Редактировать"
                        >
                          <Edit3 className="h-3 w-3" /> Ред.
                        </button>
                        <button
                          onClick={() => handleAction(() => onDeleteSchedule(s.id), true)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                          title="Удалить"
                        >
                          <Trash2 className="h-3 w-3" /> Удалить
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

      <AlertDialog open={pendingConfirm !== null} onOpenChange={(open) => !open && setPendingConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Редактирование утверждённого расписания</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены? Изменение затронет утверждённое расписание.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => { pendingConfirm?.(); setPendingConfirm(null); }}>
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивация периода</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Период будет перемещён в архив. Занятия сохранятся, но расписание станет недоступно для редактирования.</p>
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                  <p><span className="text-muted-foreground">Группа:</span> <strong>{getGroupName(period.groupId)}</strong></p>
                  <p><span className="text-muted-foreground">Период:</span> <strong>{period.periodStart} — {period.periodEnd}</strong></p>
                  <p><span className="text-muted-foreground">Занятий:</span> <strong>{schedules.length}</strong></p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={onDeletePeriod}>
              Архивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const editPeriodModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    editPeriodModalRef.current?.querySelector("input,button,select")?.focus();
  }, []);

  const handleSave = () => {
    if (!periodStart || !periodEnd) return;
    period.periodStart = periodStart;
    period.periodEnd = periodEnd;
    onSaved();
    onClose();
    toast.success("Период обновлён");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => e.key === "Escape" && onClose()} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={editPeriodModalRef} className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Редактировать период</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
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
            <p>Группа: <strong>{getGroupName(period.groupId)}</strong></p>
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
  presetDay,
  onClose,
  onSaved,
}: {
  period: SchedulePeriod;
  editScheduleId: string | null;
  presetDay?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editScheduleId ? allSchedules.find((s) => s.id === editScheduleId) : null;

  const [dayOfWeek, setDayOfWeek] = useState(existing?.dayOfWeek ?? presetDay ?? 1);
  const [timeStart, setTimeStart] = useState(existing?.timeStart ?? "09:00");
  const [timeEnd, setTimeEnd] = useState(existing?.timeEnd ?? "10:30");
  const [room, setRoom] = useState(existing?.room ?? "");
  const formModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    formModalRef.current?.querySelector("input,button,select")?.focus();
  }, []);

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
        groupId: period.groupId,
        discipline: period.discipline,
        dayOfWeek,
        timeStart,
        timeEnd,
        room: room || "Не указано",
      });
    }
    onSaved();
    onClose();
    toast.success(existing ? "Занятие обновлено" : "Занятие добавлено");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => e.key === "Escape" && onClose()} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={formModalRef} className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">
            {editScheduleId ? "Редактировать занятие" : "Новое занятие"}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
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
            <p>Группа: <strong>{getGroupName(period.groupId)}</strong></p>
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
