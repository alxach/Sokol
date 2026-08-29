import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Clock, Edit3, Check, ArrowLeft, X, CalendarDays, ChevronDown, Copy } from "lucide-react";
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
import { fetchGroups, type GroupDto } from "@/lib/api/groups.functions";
import {
  fetchSchedulePeriods,
  fetchSchedulePeriod,
  createSchedulePeriod,
  updateSchedulePeriod,
  archiveSchedulePeriod,
  approveSchedulePeriod,
  duplicateSchedulePeriod,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  type SchedulePeriodDto,
  type ScheduleItemDto,
} from "@/lib/api/schedules.functions";

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

function effectiveStatus(p: SchedulePeriodDto): SchedulePeriodDto["status"] {
  if (p.status === "active") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${p.period_end}T00:00:00`);
    if (today > end) return "archived";
  }
  return p.status;
}

function SchedulesPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach } = useAuth();
  const { selectedCenterId } = useCenter();
  const [periods, setPeriods] = useState<SchedulePeriodDto[]>([]);
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showEditPeriod, setShowEditPeriod] = useState<string | null>(null);
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [addScheduleDay, setAddScheduleDay] = useState<number | null>(null);
  const [showEditSchedule, setShowEditSchedule] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("Все");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCrossSchedule, setShowCrossSchedule] = useState(false);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate((n) => n + 1);

  const reloadPeriods = useCallback(async () => {
    setLoadError(null);
    try {
      const coachId = isCoach ? (user?.id ?? undefined) : undefined;
      const centerId = !isCoach && !isAdmin ? (selectedCenterId ?? undefined) : undefined;
      const items = await fetchSchedulePeriods(
        coachId || centerId ? { coach_user_id: coachId, center_id: centerId } : {},
      );
      setPeriods(items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Не удалось загрузить расписание");
    }
  }, [isCoach, isAdmin, selectedCenterId, user?.id]);

  const reloadGroups = useCallback(async () => {
    try {
      const res = await fetchGroups(
        isCoach ? {} : { centerId: isAdmin ? null : selectedCenterId ?? null },
      );
      let list = res.items;
      if (isCoach) {
        list = list.filter((g) => g.coach_user_id === user?.id);
      }
      setGroups(list);
    } catch {
      setGroups([]);
    }
  }, [isCoach, isAdmin, selectedCenterId, user?.id]);

  useEffect(() => {
    if (loading) return;
    Promise.all([reloadPeriods(), reloadGroups()]).finally(() => setLoadingData(false));
  }, [loading, reloadPeriods, reloadGroups]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    let cancelled = false;
    fetchSchedulePeriod(selectedPeriodId)
      .then((detail) => {
        if (!cancelled) {
          setPeriods((prev) => prev.map((p) => (p.id === selectedPeriodId ? detail : p)));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedPeriodId]);

  const userGroups = useMemo(() => {
    if (!user) return [];
    return groups;
  }, [groups, user]);

  const visiblePeriods = useMemo(() => {
    return periods.filter((p) => {
      if (selectedGroup !== "Все" && p.group_id !== selectedGroup) return false;
      const st = effectiveStatus(p);
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return st === "active";
      if (statusFilter === "draft") return st === "draft";
      if (statusFilter === "archived") return st === "archived";
      return true;
    });
  }, [periods, selectedGroup, statusFilter]);

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  const periodSchedules = useMemo(
    () => selectedPeriod?.items ?? [],
    [selectedPeriod],
  );

  const canEdit = (period: SchedulePeriodDto) => {
    const st = effectiveStatus(period);
    return isCoach && period.coach_user_id === user?.id && st !== "archived";
  };

  const handleArchivePeriod = async (periodId: string) => {
    try {
      await archiveSchedulePeriod(periodId);
      if (selectedPeriodId === periodId) setSelectedPeriodId(null);
      await reloadPeriods();
      toast.success("Период перемещён в архив");
    } catch {
      toast.error("Не удалось архивировать период");
    }
  };

  const handleApprovePeriod = async (periodId: string) => {
    try {
      await approveSchedulePeriod(periodId);
      await reloadPeriods();
      toast.success("Расписание утверждено");
    } catch {
      toast.error("Не удалось утвердить расписание");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteScheduleItem(scheduleId);
      if (selectedPeriodId) {
        const updated = await fetchSchedulePeriod(selectedPeriodId);
        setPeriods((prev) => prev.map((p) => (p.id === selectedPeriodId ? updated : p)));
      }
      toast.success("Занятие удалено");
    } catch {
      toast.error("Не удалось удалить занятие");
    }
  };

  const handleDuplicatePeriod = async (periodId: string) => {
    try {
      const newPeriod = await duplicateSchedulePeriod(periodId);
      await reloadPeriods();
      setSelectedPeriodId(newPeriod.id);
      toast.success(`Создан период ${newPeriod.period_start} — ${newPeriod.period_end}`);
    } catch {
      toast.error("Не удалось дублировать период");
    }
  };

  const handleCreatePeriod = async (groupId: string, start: string, end: string) => {
    try {
      const created = await createSchedulePeriod({
        group_id: groupId,
        period_start: start,
        period_end: end,
      });
      await reloadPeriods();
      setSelectedPeriodId(created.id);
      toast.success("Период создан");
    } catch {
      toast.error("Не удалось создать период");
    }
  };

  const handleEditPeriodSave = async (periodId: string, start: string, end: string) => {
    try {
      await updateSchedulePeriod(periodId, { period_start: start, period_end: end });
      await reloadPeriods();
      toast.success("Период обновлён");
    } catch {
      toast.error("Не удалось обновить период");
    }
  };

  const handleSaveSchedule = async (payload: {
    scheduleId: string | null;
    periodId: string;
    dayOfWeek: number;
    timeStart: string;
    timeEnd: string;
    room: string;
  }) => {
    try {
      if (payload.scheduleId) {
        await updateScheduleItem(payload.scheduleId, {
          day_of_week: payload.dayOfWeek,
          start_time: payload.timeStart,
          end_time: payload.timeEnd,
          room: payload.room || undefined,
        });
      } else {
        await createScheduleItem(payload.periodId, {
          day_of_week: payload.dayOfWeek,
          start_time: payload.timeStart,
          end_time: payload.timeEnd,
          room: payload.room || undefined,
        });
      }
      if (selectedPeriodId) {
        const updated = await fetchSchedulePeriod(selectedPeriodId);
        setPeriods((prev) => prev.map((p) => (p.id === selectedPeriodId ? updated : p)));
      }
      toast.success(payload.scheduleId ? "Занятие обновлено" : "Занятие добавлено");
    } catch {
      toast.error("Не удалось сохранить занятие");
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
          key={selectedPeriod.id}
          period={selectedPeriod}
          schedules={periodSchedules ?? []}
          canEdit={canEdit(selectedPeriod)}
          periodStatus={effectiveStatus(selectedPeriod)}
          onBack={() => setSelectedPeriodId(null)}
          onApprove={() => handleApprovePeriod(selectedPeriod.id)}
          onEditPeriod={() => setShowEditPeriod(selectedPeriod.id)}
          onArchivePeriod={() => handleArchivePeriod(selectedPeriod.id)}
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
                {loadingData ? "Загрузка…" : `${visiblePeriods.length} периодов`}
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
              {(isCoach && groups.length > 0) || isAdmin ? (
                <Button
                  onClick={() => setShowCreatePeriod(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="mr-1 h-4 w-4" /> Создать период
                </Button>
              ) : null}
            </div>
          </div>

          {loadError && !loadingData && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visiblePeriods.map((p) => {
              const st = effectiveStatus(p);
              const schedCount = (p.items ?? []).length;
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
                          st === "active" ? "bg-[color:var(--success)]"
                          : st === "draft" ? "bg-muted-foreground"
                          : "bg-border"
                        }`} />
                        <h3 className="truncate font-display text-base font-bold text-secondary">{p.group_name ?? p.group_id}</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.coach_name}</p>
                    </div>
                    <StatusBadge status={st} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {p.period_start} — {p.period_end}
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
                  {st === "draft" && isCoach && p.coach_user_id === user?.id && (
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
            {!loadingData && visiblePeriods.length === 0 && (
              <div className="col-span-full flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
                {isCoach ? "Нет периодов расписания." : "Нет периодов"}
              </div>
            )}
          </div>

          <CrossScheduleSummary periods={visiblePeriods} />
        </>
      )}

      {showEditPeriod && selectedPeriod && (
        <EditPeriodModal
          period={selectedPeriod}
          onClose={() => setShowEditPeriod(null)}
          onSaved={(start, end) => handleEditPeriodSave(selectedPeriod.id, start, end)}
        />
      )}
      {showCreatePeriod && ((isCoach && groups.length > 0) || isAdmin) && (
        <CreatePeriodModal
          groups={groups}
          onClose={() => setShowCreatePeriod(false)}
          onSave={(groupId, start, end) => handleCreatePeriod(groupId, start, end)}
        />
      )}
      {addScheduleDay !== null && selectedPeriod && (
        <ScheduleFormModal
          period={selectedPeriod}
          editSchedule={null}
          presetDay={addScheduleDay !== -1 ? addScheduleDay : null}
          onClose={() => setAddScheduleDay(null)}
          onSave={handleSaveSchedule}
        />
      )}
      {showEditSchedule && selectedPeriod && (
        <ScheduleFormModal
          period={selectedPeriod}
          editSchedule={(selectedPeriod.items ?? []).find((s) => s.id === showEditSchedule) ?? null}
          onClose={() => setShowEditSchedule(null)}
          onSave={handleSaveSchedule}
        />
      )}
    </AppShell>
  );
}

function CrossScheduleSummary({ periods }: { periods: SchedulePeriodDto[] }) {
  const [open, setOpen] = useState(false);
  const itemsWithPeriod = useMemo(
    () =>
      periods.flatMap((p) =>
        (p.items ?? []).map((s) => ({ item: s, periodName: p.group_name ?? p.group_id, discipline: p.discipline })),
      ),
    [periods],
  );
  const groupedByDay = useMemo(() => {
    const map = new Map<number, typeof itemsWithPeriod>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const entry of itemsWithPeriod) {
      map.get(entry.item.day_of_week)?.push(entry);
    }
    return map;
  }, [itemsWithPeriod]);

  if (itemsWithPeriod.length === 0) return null;

  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen(!open)}
        className="mb-4 flex items-center gap-2 text-left font-display text-lg font-bold text-secondary transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
        Сводка на неделю
      </button>
      {open && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const dayEntries = groupedByDay.get(day) ?? [];
            const isToday = new Date().getDay() === day % 7;
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
                  <p className="text-xs text-muted-foreground">{dayEntries.length} занятий</p>
                </div>
                <div className="space-y-1.5 p-2.5">
                  {dayEntries.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">Нет занятий</p>
                  )}
                  {dayEntries.map(({ item, periodName, discipline }) => (
                    <div key={item.id} className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs transition hover:border-primary/30">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>{item.start_time} – {item.end_time}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-secondary">{periodName}</p>
                      <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                        <span className="flex items-center gap-0.5">{item.room}</span>
                        {discipline && (
                          <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                            {discipline}
                          </Badge>
                        )}
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
  onArchivePeriod,
  onDuplicatePeriod,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
}: {
  period: SchedulePeriodDto;
  schedules: ScheduleItemDto[];
  canEdit: boolean;
  periodStatus: string;
  onBack: () => void;
  onApprove: () => void;
  onEditPeriod: () => void;
  onArchivePeriod: () => void;
  onDuplicatePeriod: () => void;
  onAddSchedule: (day?: number) => void;
  onEditSchedule: (id: string) => void;
  onDeleteSchedule: (id: string) => void;
}) {
  const isActive = periodStatus === "active";
  const [pendingConfirm, setPendingConfirm] = useState<(() => void) | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const offDays = useMemo(() => {
    const result = new Map<number, { type: "vacation" | "sick"; label: string }>();
    const absences = period.absences ?? [];
    if (absences.length === 0) return result;
    for (let day = 1; day <= 7; day++) {
      const start = new Date(`${period.period_start}T00:00:00`);
      const end = new Date(`${period.period_end}T00:00:00`);
      const dayOffsets: number[] = [];
      const d = new Date(start);
      while (d <= end) {
        const jsDay = d.getDay();
        const mapped = jsDay === 0 ? 7 : jsDay;
        if (mapped === day) dayOffsets.push(Math.floor((d.getTime() - start.getTime()) / 86400000));
        d.setDate(d.getDate() + 1);
      }
      const inAbsence = (aDate: Date, list: { start_date: string; end_date: string }[]) =>
        list.some((a) => {
          const s = new Date(`${a.start_date}T00:00:00`);
          const e = new Date(`${a.end_date}T00:00:00`);
          return aDate >= s && aDate <= e;
        });
      for (const offset of dayOffsets) {
        const checkDate = new Date(start);
        checkDate.setDate(checkDate.getDate() + offset);
        if (inAbsence(checkDate, absences.filter((a) => a.type === "vacation"))) {
          result.set(day, { type: "vacation", label: "Отпуск" });
          break;
        }
        if (inAbsence(checkDate, absences.filter((a) => a.type === "sick"))) {
          result.set(day, { type: "sick", label: "Больничный" });
          break;
        }
      }
    }
    return result;
  }, [period]);

  const groupedByDay = useMemo(() => {
    const map = new Map<number, ScheduleItemDto[]>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const s of schedules) map.get(s.day_of_week)?.push(s);
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
              <h2 className="font-display text-2xl font-bold text-secondary">{period.group_name}</h2>
              <StatusBadge status={periodStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {period.period_start} — {period.period_end} · {schedules.length} занятий
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
          const isToday = new Date().getDay() === day % 7;
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
                    {offDays.get(day) && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        offDays.get(day)!.type === "vacation"
                          ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
                          : "bg-destructive/10 text-destructive"
                      }`}>
                        {offDays.get(day)!.label}
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
                      <span className="font-medium text-foreground">{s.start_time} – {s.end_time}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-secondary">{period.group_name}</p>
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
                  <p><span className="text-muted-foreground">Группа:</span> <strong>{period.group_name}</strong></p>
                  <p><span className="text-muted-foreground">Период:</span> <strong>{period.period_start} — {period.period_end}</strong></p>
                  <p><span className="text-muted-foreground">Занятий:</span> <strong>{schedules.length}</strong></p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={onArchivePeriod}>
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
  period: SchedulePeriodDto;
  onClose: () => void;
  onSaved: (start: string, end: string) => void;
}) {
  const [periodStart, setPeriodStart] = useState(period.period_start);
  const [periodEnd, setPeriodEnd] = useState(period.period_end);
  const [saving, setSaving] = useState(false);
  const editPeriodModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (editPeriodModalRef.current?.querySelector("input,button,select") as HTMLElement | null)?.focus();
  }, []);

  const handleSave = () => {
    if (!periodStart || !periodEnd) return;
    setSaving(true);
    onSaved(periodStart, periodEnd);
    setSaving(false);
    onClose();
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
            <p>Группа: <strong>{period.group_name}</strong></p>
            <p>Дисциплина: <strong>{period.discipline}</strong></p>
            <p>Статус: <strong>{periodStatus_ru(period.status)}</strong></p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}

function periodStatus_ru(status: string): string {
  return ({ draft: "Черновик", active: "Активный", archived: "Архив" } as Record<string, string>)[status] ?? status;
}

function CreatePeriodModal({
  groups,
  onClose,
  onSave,
}: {
  groups: GroupDto[];
  onClose: () => void;
  onSave: (groupId: string, start: string, end: string) => void;
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const today = new Date();
  const defaultStart = today.toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 8, 1).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (ref.current?.querySelector("input,button,select") as HTMLElement | null)?.focus();
  }, []);

  const handleSave = () => {
    if (!groupId || !periodStart || !periodEnd) return;
    onSave(groupId, periodStart, periodEnd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => e.key === "Escape" && onClose()} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Создать период расписания</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа *</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
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
          <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Создать
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduleFormModal({
  period,
  editSchedule,
  presetDay,
  onClose,
  onSave,
}: {
  period: SchedulePeriodDto;
  editSchedule: ScheduleItemDto | null;
  presetDay?: number | null;
  onClose: () => void;
  onSave: (payload: {
    scheduleId: string | null;
    periodId: string;
    dayOfWeek: number;
    timeStart: string;
    timeEnd: string;
    room: string;
  }) => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState(editSchedule?.day_of_week ?? presetDay ?? 1);
  const [timeStart, setTimeStart] = useState(editSchedule?.start_time ?? "09:00");
  const [timeEnd, setTimeEnd] = useState(editSchedule?.end_time ?? "10:30");
  const [room, setRoom] = useState(editSchedule?.room ?? "");
  const formModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (formModalRef.current?.querySelector("input,button,select") as HTMLElement | null)?.focus();
  }, []);

  const handleSave = () => {
    onSave({
      scheduleId: editSchedule?.id ?? null,
      periodId: period.id,
      dayOfWeek,
      timeStart,
      timeEnd,
      room,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={(e) => e.key === "Escape" && onClose()} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={formModalRef} className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">
            {editSchedule ? "Редактировать занятие" : "Новое занятие"}
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
            <p>Группа: <strong>{period.group_name}</strong></p>
            <p>Период: {period.period_start} — {period.period_end}</p>
          </div>
          <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {editSchedule ? "Сохранить" : "Добавить"}
          </Button>
        </div>
      </div>
    </div>
  );
}