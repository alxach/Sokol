import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { CoachLeaveEntry } from "@/lib/api/coaches.functions";

interface LeaveSectionProps {
  title: string;
  periods: CoachLeaveEntry[];
  editing: boolean;
  tone: "primary" | "destructive";
  emptyLabel: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: "start_date" | "end_date", value: string) => void;
  onValidate?: (periods: CoachLeaveEntry[]) => string | null;
}

function formatDate(dateString: string): string {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

function hasActivePeriod(periods: CoachLeaveEntry[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return periods.some((p) => {
    if (!p.start_date || !p.end_date) return false;
    const start = new Date(`${p.start_date}T00:00:00`);
    const end = new Date(`${p.end_date}T00:00:00`);
    return start <= today && today <= end;
  });
}

export function checkOverlaps(periods: CoachLeaveEntry[]): string | null {
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
        return `Периоды ${i + 1} и ${j + 1} пересекаются`;
      }
    }
  }
  return null;
}

export function LeaveSection({
  title,
  periods,
  editing,
  tone,
  emptyLabel,
  onAdd,
  onRemove,
  onUpdate,
  onValidate,
}: LeaveSectionProps) {
  const active = hasActivePeriod(periods);
  const activeLabel = tone === "primary" ? "В отпуске" : "На больничном";
  const idleLabel = tone === "primary" ? "Работает" : "Здоров";
  const validationError = onValidate ? onValidate(periods) : null;

  const toneStyles = {
    primary: {
      active: "bg-primary/10 text-primary border-primary/30",
      idle: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    },
    destructive: {
      active: "bg-destructive/10 text-destructive border-destructive/30",
      idle: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    },
  };

  return (
    <div className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              active
                ? toneStyles[tone].active
                : toneStyles[tone].idle
            }`}
          >
            {active ? activeLabel : idleLabel}
          </span>
          {editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAdd}
              aria-label={`Добавить запись: ${title}`}
              className="gap-1.5"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Добавить период
            </Button>
          )}
        </div>
      </div>

      {editing && !periods.some((p) => p.start_date && p.end_date) && (
        <p className="mb-3 text-xs text-muted-foreground" role="note">
          Укажите даты начала и окончания периода, затем нажмите «Сохранить {title.toLowerCase()}». Чтобы добавить ещё один период, нажмите «Добавить период».
        </p>
      )}

      {validationError && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      )}

      {periods.length === 0 && !editing && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}

      <div className="space-y-2">
        {periods.map((period, index) => (
          <div
            key={`${period.start_date}-${period.end_date}-${index}`}
            className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-2.5"
          >
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <span className="block text-[10px] uppercase text-muted-foreground">С</span>
                {editing ? (
                  <Input
                    type="date"
                    value={period.start_date}
                    onChange={(e) => onUpdate(index, "start_date", e.target.value)}
                    className="h-8 text-xs"
                    aria-label={`Начало ${title.toLowerCase()} ${index + 1}`}
                  />
                ) : (
                  <div className="mt-0.5 text-xs text-secondary">{formatDate(period.start_date)}</div>
                )}
              </div>
              <div className="flex-1">
                <span className="block text-[10px] uppercase text-muted-foreground">По</span>
                {editing ? (
                  <Input
                    type="date"
                    value={period.end_date}
                    onChange={(e) => onUpdate(index, "end_date", e.target.value)}
                    className="h-8 text-xs"
                    aria-label={`Конец ${title.toLowerCase()} ${index + 1}`}
                  />
                ) : (
                  <div className="mt-0.5 text-xs text-secondary">{formatDate(period.end_date)}</div>
                )}
              </div>
            </div>
            {editing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                aria-label={`Удалить запись: ${title}`}
                className="mt-2 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}