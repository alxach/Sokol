import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Plus,
  X,
  Trash2,
  MapPin,
  Clock3,
  Users,
  Calendar as CalendarIcon,
  AlertTriangle,
  LogIn,
  Target,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { useCenter } from "@/lib/center";
import {
  fetchTrainings,
  createTraining,
  updateTraining,
  deleteTraining,
  selectTraining,
  cancelTraining,
  setTrainingAttendance,
  toApiDate,
  fmtTime,
  type TrainingDto,
} from "@/lib/api/trainings.functions";

export const Route = createFileRoute("/trainings")({
  head: () => ({
    meta: [
      { title: "Тренировки — СОКОЛ" },
      { name: "description", content: "Подбор тренировок с сотрудниками РУСАЛа." },
    ],
  }),
  component: TrainingsPage,
});

const statusLabel: Record<string, string> = {
  proposed: "Предложена",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
};

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function firstDay(d: Date): string {
  return toApiDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function lastDay(d: Date): string {
  return toApiDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function sortByDate(a: TrainingDto, b: TrainingDto): number {
  return (a.date + a.start_time).localeCompare(b.date + b.start_time);
}

function TrainingsPage() {
  const { loading } = useAuthGuard();
  const { user, isCoach, isAdmin, isDirector, isSuperadmin } = useAuth();
  const { selectedCenterId } = useCenter();

  const [items, setItems] = useState<TrainingDto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date());
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [editing, setEditing] = useState<TrainingDto | null>(null);
  const [details, setDetails] = useState<TrainingDto | null>(null);
  const [selecting, setSelecting] = useState<TrainingDto | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<TrainingDto | null>(null);

  const canManage = isAdmin || isDirector || isSuperadmin;
  const centerParam = isDirector || isSuperadmin ? selectedCenterId : undefined;

  const load = useCallback(async () => {
    try {
      const data = await fetchTrainings({
        center_id: centerParam || undefined,
        date_from: firstDay(monthCursor),
        date_to: lastDay(monthCursor),
        per_page: 200,
      });
      setItems(data.sort(sortByDate));
      setItemsError(null);
      return data;
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : "Не удалось загрузить тренировки");
      return null;
    } finally {
      setDataLoading(false);
    }
  }, [centerParam, monthCursor]);

  useEffect(() => {
    void load();
  }, [load]);

  const { available, mine } = useMemo(() => {
    if (isCoach) {
      const availableItems = items.filter((t) => t.status === "proposed" && !t.coach_id);
      const myItems = items.filter((t) => t.coach_user_id === user?.id && t.status === "confirmed");
      return { available: availableItems, mine: myItems };
    }
    return {
      available: items.filter((t) => t.status === "proposed"),
      mine: items.filter((t) => t.status === "confirmed"),
    };
  }, [items, isCoach, user?.id]);

  const monthLabel = format(monthCursor, "LLLL yyyy", { locale: ru });
  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const shiftMonth = (delta: number) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleCreate = async (data: { date: Date; start_time: string; location: string }) => {
    try {
      await createTraining({
        date: toApiDate(data.date),
        start_time: data.start_time,
        location: data.location,
        center_id: centerParam || undefined,
      });
      setCreateDate(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось создать тренировку");
    }
  };

  const handleUpdate = async (
    id: string,
    data: { date: Date; start_time: string; location: string },
  ) => {
    try {
      await updateTraining(id, {
        date: toApiDate(data.date),
        start_time: data.start_time,
        location: data.location,
      });
      setEditing(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось обновить тренировку");
    }
  };

  const handleDelete = async (t: TrainingDto) => {
    if (!confirm("Удалить предложенный слот тренировки?")) return;
    try {
      await deleteTraining(t.id);
      setEditing(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить тренировку");
    }
  };

  const handleCancel = async (t: TrainingDto) => {
    if (!confirm("Снять тренера с подтверждённой тренировки? Связанный пункт плана будет удалён."))
      return;
    try {
      await cancelTraining(t.id);
      setDetails(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось отменить тренировку");
    }
  };

  const handleSelect = async (t: TrainingDto, data: { goal: string }) => {
    try {
      await selectTraining(t.id, data);
      setSelecting(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось записаться на тренировку");
    }
  };

  const handleAttendance = async (t: TrainingDto, participantsCount: number) => {
    try {
      await setTrainingAttendance(t.id, participantsCount);
      setAttendanceTarget(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить явку");
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
    <AppShell title="Тренировки" subtitle="Мероприятия с сотрудниками РУСАЛа">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">
            Тренировки с сотрудниками РУСАЛа
          </h2>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Предлагайте слоты — тренеры выбирают удобные даты."
              : "Выбирайте свободные даты — занятость фиксируется в ежегодном плане."}
          </p>
        </div>
        {canManage && (
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateDate(new Date())}
          >
            <Plus className="mr-2 h-4 w-4" /> Предложить тренировку
          </Button>
        )}
      </div>

      {itemsError && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {itemsError}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
        <Button variant="outline" size="sm" className="h-8" onClick={() => shiftMonth(-1)}>
          ← Предыдущий
        </Button>
        <span className="font-display text-sm font-bold uppercase tracking-wider text-primary">
          {monthTitle}
        </span>
        <Button variant="outline" size="sm" className="h-8" onClick={() => shiftMonth(1)}>
          Следующий →
        </Button>
      </div>

      {dataLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Загрузка тренировок…</div>
      ) : isCoach ? (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-primary">
              Доступные ({available.length})
            </h3>
            {available.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                В этом месяце свободных слотов нет. Загляните позже — руководитель регулярно
                добавляет даты.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {available.map((t) => (
                  <TrainingCard
                    key={t.id}
                    training={t}
                    actions={
                      <Button
                        size="sm"
                        className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setSelecting(t)}
                      >
                        <LogIn className="mr-1 h-3.5 w-3.5" /> Записаться
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-secondary">
              Мои тренировки ({mine.length})
            </h3>
            {mine.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Вы ещё не записались на тренировки в этом месяце.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((t) => (
                  <TrainingCard
                    key={t.id}
                    training={t}
                    actions={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setAttendanceTarget(t)}
                      >
                        <Users className="mr-1 h-3.5 w-3.5" />
                        {t.participants_count != null
                          ? `Явка: ${t.participants_count} чел. (изменить)`
                          : "Отметить явку"}
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <MonthGrid
          month={monthCursor}
          items={items}
          onCreateDay={(date) => setCreateDate(date)}
          onEditSlot={setEditing}
          onViewSlot={setDetails}
        />
      )}

      {(createDate || editing) && (
        <TrainingFormModal
          title={editing ? "Изменить тренировку" : "Новая тренировка"}
          submitLabel={editing ? "Сохранить" : "Предложить"}
          training={editing ?? undefined}
          initialDate={createDate ?? undefined}
          onSave={(data) => (editing ? handleUpdate(editing.id, data) : handleCreate(data))}
          onDelete={editing ? () => handleDelete(editing) : undefined}
          onClose={() => {
            setCreateDate(null);
            setEditing(null);
          }}
        />
      )}

      {details && (
        <TrainingDetailsModal
          training={details}
          onCancel={() => handleCancel(details)}
          onAttendance={() => setAttendanceTarget(details)}
          onClose={() => setDetails(null)}
        />
      )}

      {attendanceTarget && (
        <AttendanceModal
          training={attendanceTarget}
          onSave={(count) => handleAttendance(attendanceTarget, count)}
          onClose={() => setAttendanceTarget(null)}
        />
      )}

      {selecting && (
        <SelectTrainingModal
          training={selecting}
          onSave={handleSelect}
          onClose={() => setSelecting(null)}
        />
      )}
    </AppShell>
  );
}

function TrainingCard({ training, actions }: { training: TrainingDto; actions?: React.ReactNode }) {
  const dateObj = new Date(`${training.date}T00:00:00`);
  const isPast = training.date < toApiDate(new Date());
  return (
    <Card
      className={`group border-border p-4 shadow-[var(--shadow-card)] transition hover:shadow-md ${
        training.status === "confirmed"
          ? "border-primary/30 bg-primary/[0.02]"
          : "hover:border-primary/30"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`truncate text-sm font-bold ${training.status === "confirmed" ? "text-primary" : "text-secondary"}`}
            >
              {format(dateObj, "d MMMM yyyy", { locale: ru })}
            </span>
            <Badge
              variant="outline"
              className={`shrink-0 font-normal ${
                training.status === "confirmed"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              {statusLabel[training.status] ?? training.status}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3 w-3" />
            {fmtTime(training.start_time)}
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {training.location}
            </span>
          </div>
        </div>
      </div>

      {(training.coach_name || training.participants_count != null) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
          {training.coach_name && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {training.coach_name}
            </span>
          )}
          {training.participants_count != null && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-secondary">
              {training.participants_count} чел.
            </span>
          )}
        </div>
      )}

      {training.goal && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{training.goal}</p>
      )}

      {isPast && training.status === "proposed" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          Дата уже прошла — слот можно удалить.
        </p>
      )}

      {actions && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
          {actions}
        </div>
      )}
    </Card>
  );
}

function MonthLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-border bg-muted/40" />
        Предложена
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        Подтверждена
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-muted/50 line-through" />
        Отменена
      </span>
      <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
        <Plus className="h-3 w-3" /> Клик по дню — предложить слот
      </span>
    </div>
  );
}

const MONTH_CELLS = 42;

function MonthGrid({
  month,
  items,
  onCreateDay,
  onEditSlot,
  onViewSlot,
}: {
  month: Date;
  items: TrainingDto[];
  onCreateDay: (date: Date) => void;
  onEditSlot: (t: TrainingDto) => void;
  onViewSlot: (t: TrainingDto) => void;
}) {
  const slotsByDay = useMemo(() => {
    const map = new Map<string, TrainingDto[]>();
    for (const t of items) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return map;
  }, [items]);

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstOfMonth = new Date(year, monthIdx, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const today = toApiDate(new Date());

  const cells = useMemo(() => {
    const list: { date: Date; key: string; inMonth: boolean }[] = [];
    for (let i = 0; i < MONTH_CELLS; i++) {
      const date = new Date(year, monthIdx, 1 - startOffset + i);
      list.push({ date, key: toApiDate(date), inMonth: date.getMonth() === monthIdx });
    }
    return list;
  }, [year, monthIdx, startOffset]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-7 gap-px bg-border/60">
        {WEEK_DAYS.map((w) => (
          <div
            key={w}
            className="bg-muted/40 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          const slots = slotsByDay.get(cell.key) ?? [];
          return (
            <div
              key={cell.key}
              className={`flex min-h-[92px] flex-col gap-1 p-1.5 transition ${cell.inMonth ? "group cursor-pointer bg-card hover:bg-accent/40" : "bg-muted/20"}`}
              role={cell.inMonth ? "button" : undefined}
              tabIndex={cell.inMonth ? 0 : undefined}
              onClick={() => {
                if (cell.inMonth) onCreateDay(cell.date);
              }}
              onKeyDown={(e) => {
                if (cell.inMonth && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onCreateDay(cell.date);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${cell.key === today ? "text-primary" : cell.inMonth ? "text-secondary" : "text-muted-foreground"}`}
                >
                  {cell.date.getDate()}
                </span>
                {cell.key === today && (
                  <span className="rounded bg-primary px-1 py-0.5 text-[9px] font-semibold uppercase text-primary-foreground">
                    Сегодня
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {slots.length === 0
                  ? cell.inMonth && (
                      <span className="hidden items-center gap-1 text-[10px] text-muted-foreground group-hover:flex">
                        <Plus className="h-3 w-3" /> Слот
                      </span>
                    )
                  : slots.map((t) => (
                      <SlotChip key={t.id} training={t} onEdit={onEditSlot} onView={onViewSlot} />
                    ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotChip({
  training,
  onEdit,
  onView,
}: {
  training: TrainingDto;
  onEdit: (t: TrainingDto) => void;
  onView: (t: TrainingDto) => void;
}) {
  const time = fmtTime(training.start_time);
  const confirmed = training.status === "confirmed";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (training.status === "proposed") onEdit(training);
    else if (confirmed) onView(training);
  };

  const title = confirmed
    ? `${time} · ${training.coach_name || "тренер"}${training.participants_count != null ? ` · ${training.participants_count} чел.` : ""} · ${training.location}`
    : `${time} · ${training.location}`;

  if (training.status === "cancelled") {
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1 truncate rounded-md bg-muted/40 px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground line-through"
      >
        {time}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        confirmed
          ? "bg-primary/90 text-primary-foreground hover:bg-primary"
          : "border border-border bg-background text-secondary hover:border-primary/40 hover:text-primary"
      }`}
    >
      {time}
      {confirmed && training.participants_count != null && (
        <span className="inline-flex items-center gap-0.5 font-normal opacity-90">
          <Users className="h-3 w-3" />
          {training.participants_count}
        </span>
      )}
    </button>
  );
}

function TrainingDetailsModal({
  training,
  onCancel,
  onAttendance,
  onClose,
}: {
  training: TrainingDto;
  onCancel: () => void;
  onAttendance: () => void;
  onClose: () => void;
}) {
  const dateObj = new Date(`${training.date}T00:00:00`);
  const ready = training.status === "confirmed";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-secondary">
              Тренировка с сотрудниками РУСАЛа
            </h3>
            <p className="text-sm text-muted-foreground">
              {format(dateObj, "d MMMM yyyy", { locale: ru })} · {fmtTime(training.start_time)} ·{" "}
              {training.location}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
                ready
                  ? "bg-primary/10 text-primary"
                  : training.status === "cancelled"
                    ? "bg-muted/50 text-muted-foreground line-through"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {statusLabel[training.status] ?? training.status}
            </span>
          </div>

          {(training.coach_name || training.participants_count != null) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {training.coach_name && (
                <span className="inline-flex items-center gap-1.5 text-secondary">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {training.coach_name}
                </span>
              )}
              {training.participants_count != null && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-secondary">
                  {training.participants_count} чел.
                </span>
              )}
            </div>
          )}

          {training.goal && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm leading-relaxed text-secondary">
              <span className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Цель
              </span>
              {training.goal}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Внесена в ежегодный план (категория «мероприятия») и будет подставлена в отчёт.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
            Закрыть
          </Button>
          {ready && (
            <Button variant="outline" size="sm" className="h-8" onClick={onAttendance}>
              <Users className="mr-1 h-3.5 w-3.5" />
              {training.participants_count != null
                ? `Явка: ${training.participants_count} чел. (изменить)`
                : "Отметить явку"}
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onCancel}
          >
            <X className="mr-1 h-3 w-3" /> Снять тренера
          </Button>
        </div>
      </div>
    </div>
  );
}

function TrainingFormModal({
  title,
  submitLabel,
  training,
  initialDate,
  onSave,
  onDelete,
  onClose,
}: {
  title: string;
  submitLabel: string;
  training?: TrainingDto;
  initialDate?: Date;
  onSave: (data: { date: Date; start_time: string; location: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    training ? new Date(`${training.date}T00:00:00`) : initialDate,
  );
  const [startTime, setStartTime] = useState(training ? fmtTime(training.start_time) : "18:00");
  const [location, setLocation] = useState(training?.location ?? "");
  const dateStr = selectedDate ? format(selectedDate, "dd.MM.yyyy") : "";
  const canSave = Boolean(selectedDate) && Boolean(startTime.trim()) && Boolean(location.trim());

  const handleSave = () => {
    if (!canSave || !selectedDate) return;
    onSave({ date: selectedDate, start_time: startTime.trim(), location: location.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-display text-lg font-bold text-secondary">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата *</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateStr || <span className="text-muted-foreground">Выберите дату</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  locale={ru}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Время начала *
            </label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Место проведения *
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ЦСЕ «Сокол», большой зал…"
              className="h-9"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Удалить
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
              Отмена
            </Button>
            <Button
              size="sm"
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!canSave}
              onClick={handleSave}
            >
              <Plus className="mr-1 h-3 w-3" /> {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectTrainingModal({
  training,
  onSave,
  onClose,
}: {
  training: TrainingDto;
  onSave: (training: TrainingDto, data: { goal: string }) => void;
  onClose: () => void;
}) {
  const [goal, setGoal] = useState("");
  const canSave = goal.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(training, { goal: goal.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">Запись на тренировку</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(`${training.date}T00:00:00`), "d MMMM yyyy", { locale: ru })} ·{" "}
              {fmtTime(training.start_time)} · {training.location}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Цель тренировки *
            </label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ознакомительная тренировка, разбор техники, общая физическая подготовка…"
              rows={4}
            />
          </div>
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            После подтверждения тренировка появится в вашем ежегодном плане (категория
            «мероприятия») и в отчёте. Количество участников вы укажете по факту после тренировки.
            Записаться можно только на одну тренировку в день.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
            Отмена
          </Button>
          <Button
            size="sm"
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSave}
            onClick={handleSave}
          >
            <LogIn className="mr-1 h-3 w-3" /> Подтвердить
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttendanceModal({
  training,
  onSave,
  onClose,
}: {
  training: TrainingDto;
  onSave: (participantsCount: number) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(
    training.participants_count != null ? String(training.participants_count) : "",
  );
  const countNum = Number(count);
  const canSave = Number.isInteger(countNum) && countNum >= 1 && countNum <= 30;

  const handleSave = () => {
    if (!canSave) return;
    onSave(countNum);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">Явка на тренировку</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(`${training.date}T00:00:00`), "d MMMM yyyy", { locale: ru })} ·{" "}
              {fmtTime(training.start_time)} · {training.location}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Фактическое количество участников *
            </label>
            <Input
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="Например, 15"
              className="h-9"
            />
          </div>
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Укажите число сотрудников, реально пришедших на тренировку (от 1 до 30). Значение
            подставится в ежегодный план и отчёт.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
            Отмена
          </Button>
          <Button
            size="sm"
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSave}
            onClick={handleSave}
          >
            <Users className="mr-1 h-3 w-3" /> Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
