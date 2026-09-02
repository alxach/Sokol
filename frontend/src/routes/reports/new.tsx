import { useState, useMemo, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Send, Save, Lightbulb, ClipboardList, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useAuthGuard } from "@/lib/auth";
import {
  type ReportTemplateDto, type ReportFieldDto, type ReportDto, type ReportCreatePayload,
  fetchReportTemplates, createReport, updateReport,
} from "@/lib/api/reports.functions";
import { fetchGroups, type GroupDto } from "@/lib/api/groups.functions";
import { fetchAthletes, calcAge } from "@/lib/api/athletes.functions";
import { fetchSchedulePeriods, type SchedulePeriodDto } from "@/lib/api/schedules.functions";
import { fetchPlans, monthName } from "@/lib/api/plans.functions";
import { fetchCriteria, type CoachTier } from "@/lib/api/criteria.functions";
import type { PlanItem } from "@/lib/api/plans.functions";
import { fetchTrainings, type TrainingDto } from "@/lib/api/trainings.functions";

export const Route = createFileRoute("/reports/new")({
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = typeof search.reportId === "string" ? search.reportId : undefined;
    return reportId ? { reportId } : {};
  },
  head: () => ({
    meta: [
      { title: "Новый отчёт — СОКОЛ" },
      { name: "description", content: "Создание ежемесячного отчёта тренера." },
    ],
  }),
  component: NewReportPage,
});

const now = new Date();
const defaultStart = withDay(now.getFullYear(), now.getMonth(), 1);
const defaultEnd = withDay(now.getFullYear(), now.getMonth() + 1, 0);

function withDay(year: number, month: number, day: number): string {
  return format(new Date(year, month, day), "dd.MM.yyyy");
}

function formatPlanItemShort(item: PlanItem): string {
  const parts: string[] = [];
  if (item.date) parts.push(item.date);
  parts.push(item.name);
  if (item.location) parts.push(`(${item.location})`);
  if (item.participantsCount) parts.push(`— ${item.participantsCount} уч.`);
  return parts.join(" ");
}

function formatTrainingShort(t: TrainingDto): string {
  const parts: string[] = [];
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.date);
  parts.push(d ? `${d[3]}.${d[2]}.${d[1]}` : t.date);
  parts.push("Тренировка с сотрудниками РУСАЛа");
  if (t.location) parts.push(`(${t.location})`);
  if (t.participants_count != null) parts.push(`— ${t.participants_count} уч.`);
  if (t.goal) parts.push(`— ${t.goal}`);
  return parts.join(" ");
}

function ruToIso(dateStr: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateStr.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function isoToRu(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

function parseDate(dateStr: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateStr.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeToMinutes(t: string): number {
  const [h, min] = t.split(":").map(Number);
  return (h || 0) * 60 + (min || 0);
}

function dateOverlapsAbsence(d: Date, absences: SchedulePeriodDto["absences"]): boolean {
  return absences.some((a) => {
    const start = new Date(`${a.start_date}T00:00:00`);
    const end = new Date(`${a.end_date}T00:00:00`);
    return d >= start && d <= end;
  });
}

function calcWeeklyHours(
  periods: SchedulePeriodDto[],
  periodStart: string,
  periodEnd: string,
): number {
  const start = parseDate(periodStart);
  const end = parseDate(periodEnd);
  if (!start || !end) return 0;

  const overlapping = periods.filter((sp) => {
    if (sp.status === "archived") return false;
    const spStart = new Date(`${sp.period_start}T00:00:00`);
    const spEnd = new Date(`${sp.period_end}T00:00:00`);
    return spStart <= end && spEnd >= start;
  });

  if (overlapping.length === 0) return 0;

  const minutesByDay: Record<number, number> = {};
  for (const period of overlapping) {
    for (const item of period.items ?? []) {
      minutesByDay[item.day_of_week] =
        (minutesByDay[item.day_of_week] ?? 0) +
        (timeToMinutes(item.end_time) - timeToMinutes(item.start_time));
    }
  }

  const absences = overlapping.flatMap((p) => p.absences ?? []);

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const totalWeeks = totalDays / 7;

  let absenceMinutes = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const jsDay = cursor.getDay();
    const dow = jsDay === 0 ? 7 : jsDay;
    if (minutesByDay[dow] && dateOverlapsAbsence(cursor, absences)) {
      absenceMinutes += minutesByDay[dow];
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalScheduledMinutes =
    Object.values(minutesByDay).reduce((a, b) => a + b, 0) * totalWeeks;
  const effectiveMinutes = totalScheduledMinutes - absenceMinutes;

  if (totalWeeks <= 0) return 0;
  return Math.round((effectiveMinutes / totalWeeks / 60) * 10) / 10;
}

function NewReportPage() {
  const { loading } = useAuthGuard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/reports/new" });
  const editReportId = search.reportId;

  const [template, setTemplate] = useState<ReportTemplateDto | null>(null);
  const [editing, setEditing] = useState<ReportDto | null>(null);
  const [coachGroups, setCoachGroups] = useState<GroupDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachTier, setCoachTier] = useState<CoachTier | null>(null);

  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [form, setForm] = useState<Record<string, string>>({});
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});

  const coachUserIds = coachGroups
    .map((g) => g.coach_user_id)
    .filter((id): id is string => Boolean(id));

  // ── Initial load: template + coach context ──────────────────────────────
  useEffect(() => {
    async function boot() {
      try {
        setError(null);
        const templates = await fetchReportTemplates();
        const tpl = templates.find((t) => t.code === "monthly_coach_report") ?? templates[0];
        setTemplate(tpl ?? null);

        let groups: GroupDto[] = [];
        if (user?.id) {
          const { items } = await fetchGroups({ perPage: 1000 });
          groups = items.filter((g) => g.coach_user_id === user.id);
          setCoachGroups(groups);
        }

        if (editReportId) {
          const { fetchReport } = await import("@/lib/api/reports.functions");
          const report = await fetchReport(editReportId);
          setEditing(report);
          setPeriodStart(isoToRu(report.period_start));
          setPeriodEnd(isoToRu(report.period_end));
          const initial: Record<string, string> = {};
          for (const key of Object.keys(report.data_json)) {
            const v = report.data_json[key];
            if (typeof v === "number") initial[key] = String(v);
            else if (typeof v === "string") initial[key] = v;
          }
          setForm(initial);
        } else {
          const initial: Record<string, string> = {};
          for (const f of tpl?.structure_json?.fields ?? []) initial[f.key] = "";
          setForm(initial);
        }

        try {
          const criteriaList = await fetchCriteria();
          const rec = criteriaList[0];
          setCoachTier(rec?.assigned_tier ?? null);
        } catch {
          /* тир выплаты — необязательный блок */
        }
      } catch (err) {
        console.error("Ошибка загрузки формы отчёта:", err);
        setError("Не удалось подготовить форму отчёта.");
      }
    }
    void boot();
  }, [editReportId, user?.id]);

  // ── Plan hints ──────────────────────────────────────────────────────────
  const periodDate = useMemo(() => parseDate(periodStart), [periodStart]);
  const monthNum = periodDate ? periodDate.getMonth() + 1 : null;
  const monthNameRu = monthNum ? monthName(monthNum) : "";

  const [planHints, setPlanHints] = useState<{
    category3: PlanItem[];
    category4: PlanItem[];
    category5: PlanItem[];
  }>({ category3: [], category4: [], category5: [] });

  const [trainingHints, setTrainingHints] = useState<TrainingDto[]>([]);

  // ── Auto-fill #1: athletes count (≤21) ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function calcAthletes() {
      if (!user?.id || !editReportId) return;
      if (editing?.data_json?.athletes_count != null) return;
      try {
        const groupIds = coachGroups.map((g) => g.id);
        const athleteIds = new Set<string>();
        for (const g of coachGroups) for (const id of g.athlete_ids) athleteIds.add(id);
        if (groupIds.length === 0) {
          if (!cancelled) {
            setForm((prev) => (prev.athletes_count?.trim() ? prev : { ...prev, athletes_count: "0" }));
            setAutoFilled((prev) => ({ ...prev, athletes_count: true }));
          }
          return;
        }
        const { items } = await fetchAthletes({ coachId: user.id });
        const count = items.filter(
          (a) =>
            a.status === "active" &&
            athleteIds.has(a.id) &&
            calcAge(a.birth_date) <= 21,
        ).length;
        if (!cancelled) {
          setForm((prev) => (prev.athletes_count?.trim() ? prev : { ...prev, athletes_count: String(count) }));
          setAutoFilled((prev) => ({ ...prev, athletes_count: true }));
        }
      } catch (err) {
        console.error("Ошибка расчёта спортсменов:", err);
      }
    }
    void calcAthletes();
    return () => { cancelled = true; };
  }, [user, coachGroups, editReportId, editing]);

  // ── Auto-fill #2: weekly hours from schedule ────────────────────────────
  const recalcHours = useCallback(async () => {
    if (!user?.id || editReportId) return;
    try {
      const periods = await fetchSchedulePeriods({ coach_user_id: user.id });
      const hrs = calcWeeklyHours(periods, periodStart, periodEnd);
      setForm((prev) => (prev.hours_per_week?.trim() ? prev : { ...prev, hours_per_week: String(hrs) }));
      setAutoFilled((prev) => ({ ...prev, hours_per_week: true }));
    } catch (err) {
      console.error("Ошибка расчёта часов:", err);
    }
  }, [user, periodStart, periodEnd, editReportId]);

  useEffect(() => {
    void recalcHours();
  }, [recalcHours]);

  // ── Auto-fill #3: plan hints for textarea fields ────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadHints() {
      if (!monthNum || editReportId) return;
      try {
        const plans = await fetchPlans({ centerId: user?.centerId });
        const currentYear = new Date().getFullYear();
        const plan = plans.find(
          (p) =>
            p.coachId === user?.id &&
            p.year === currentYear &&
            (p.status === "approved" || p.status === "submitted"),
        );
        if (!plan || cancelled) return;
        const items = plan.items.filter(
          (i) =>
            i.status === "approved" || i.status === "submitted",
        );
        // filter by current month via date field
        const monthItems = items.filter((i) => {
          const d = i.date ? new Date(i.date) : null;
          if (d && !Number.isNaN(d.getTime())) return d.getMonth() + 1 === monthNum;
          return i.month === monthNameRu;
        });
        setPlanHints({
          category3: monthItems.filter((i) => i.categoryId === "3"),
          category4: monthItems.filter((i) => i.categoryId === "4"),
          category5: monthItems.filter((i) => i.categoryId === "5"),
        });
      } catch (err) {
        console.error("Ошибка загрузки плана:", err);
      }
    }
    void loadHints();
    return () => { cancelled = true; };
  }, [monthNum, editReportId, user?.id, user?.centerId]);

  // ── Auto-fill #3b: confirmed trainings for sport_events ────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadTrainings() {
      if (editReportId) return;
      const startIso = ruToIso(periodStart);
      const endIso = ruToIso(periodEnd);
      if (!startIso || !endIso) return;
      try {
        const items = await fetchTrainings({
          date_from: startIso,
          date_to: endIso,
          status: "confirmed",
          per_page: 200,
        });
        const own = items.filter((t) => !user?.id || t.coach_user_id === user.id);
        if (!cancelled) setTrainingHints(own);
      } catch (err) {
        console.error("Ошибка загрузки тренировок:", err);
      }
    }
    void loadTrainings();
    return () => { cancelled = true; };
  }, [editReportId, periodStart, periodEnd, user?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setAutoFilled((prev) => ({ ...prev, [key]: false }));
  };

  const fillFromPlan = (fieldKey: string, hasPlan: PlanItem[]) => {
    if (hasPlan.length === 0) return;
    const text = hasPlan
      .map((item, i) => `${i + 1}. ${formatPlanItemShort(item)}`)
      .join("\n");
    setForm((prev) => ({ ...prev, [fieldKey]: text }));
    setAutoFilled((prev) => ({ ...prev, [fieldKey]: false }));
  };

  const fillFromTrainings = (fieldKey: string, items: TrainingDto[]) => {
    if (items.length === 0) return;
    const text = items
      .map((t, i) => `${i + 1}. ${formatTrainingShort(t)}`)
      .join("\n");
    setForm((prev) => ({ ...prev, [fieldKey]: text }));
    setAutoFilled((prev) => ({ ...prev, [fieldKey]: false }));
  };

  const save = async (submitNow: boolean) => {
    if (!template || !periodStart || !periodEnd) return;
    setSaving(true);
    setError(null);
    try {
      const data: Record<string, string | number> = {
        ...form,
        athletes_count: Number(form.athletes_count) || 0,
        hours_per_week: Number(form.hours_per_week) || 0,
      };
      const periodStartIso = ruToIso(periodStart);
      const periodEndIso = ruToIso(periodEnd);
      if (!periodStartIso || !periodEndIso) {
        setError("Даты периода указаны неверно (ожидается ДД.ММ.ГГГГ).");
        setSaving(false);
        return;
      }

      if (editing) {
        await updateReport(editing.id, {
          period_start: periodStartIso,
          period_end: periodEndIso,
          data_json: data,
          period_type: "monthly",
        });
        if (submitNow) {
          const { submitReport } = await import("@/lib/api/reports.functions");
          await submitReport(editing.id);
        }
        navigate({ to: "/reports" });
        return;
      }

      const payload: ReportCreatePayload = {
        template_id: template.id,
        period_type: "monthly",
        period_start: periodStartIso,
        period_end: periodEndIso,
        data_json: data,
      };
      const created = await createReport(payload);
      if (submitNow) {
        const { submitReport } = await import("@/lib/api/reports.functions");
        await submitReport(created.id);
      }
      navigate({ to: "/reports" });
    } catch (err) {
      console.error("Ошибка сохранения отчёта:", err);
      setError("Не удалось сохранить отчёт. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  const requiredKeys = ["athletes_count", "hours_per_week"];
  const isValid =
    requiredKeys.every((k) => form[k]?.trim() !== "") &&
    Boolean(periodStart.trim()) && Boolean(periodEnd.trim());

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <AppShell title="Новый отчёт" subtitle="Ежемесячный отчёт тренера-преподавателя ЦСЕ">
        <p className="text-sm text-destructive">{error ?? "Шаблон отчёта не найден."}</p>
      </AppShell>
    );
  }

  const fields: ReportFieldDto[] = template?.structure_json?.fields ?? [];

  const planHintMap: Record<string, PlanItem[] | undefined> = {
    special_events: planHints.category3,
    sport_events: planHints.category4,
    development_events: planHints.category5,
  };

  return (
    <AppShell
      title={editing ? "Редактирование отчёта" : "Новый отчёт"}
      subtitle="Ежемесячный отчёт тренера-преподавателя ЦСЕ"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate({ to: "/reports" })}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> К списку отчётов
          </button>
          <h2 className="font-display text-2xl font-bold text-secondary">
            {template.name}
          </h2>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => save(false)} disabled={!isValid || saving}>
            <Save className="mr-1.5 h-4 w-4" /> {editing ? "Сохранить" : "Сохранить черновик"}
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => save(true)}
            disabled={!isValid || saving}
          >
            <Send className="mr-1.5 h-4 w-4" /> Отправить на проверку
          </Button>
          {coachUserIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void recalcHours()} disabled={saving}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Пересчитать
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {coachTier === null ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <span>
            Выплата не назначена: руководитель центра ещё не выбрал для вас тир (базовый/полный). Отчёт можно подать,
            но сумма по нему составит 0 ₽.
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span>
            Тир выплаты: <span className="font-semibold">{coachTier === "full" ? "полный" : "базовый"}</span>.
            При выполнении норм отчёта сумма составит максимум (полный) или минимум (базовый) активной программы.
          </span>
        </div>
      )}

      <Card className="shadow-[var(--shadow-card)]">
        <div className="border-b border-border p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Отчётный период *</label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="ДД.ММ.ГГГГ"
                  className="h-9 w-32"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  placeholder="ДД.ММ.ГГГГ"
                  className="h-9 w-32"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
              <Input className="h-9" value={editing?.sport ?? (coachGroups[0]?.sport_type ?? "")} readOnly />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {coachGroups.length > 0 ? (
                  coachGroups.map((g) => (
                    <Badge key={g.id} variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                      {g.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Нет групп</span>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО тренера</label>
              <Input className="h-9" value={editing?.coach_name ?? user?.coachName ?? ""} readOnly />
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {fields.map((field) => {
            const planItemsForField = planHintMap[field.key];
            const hasPlanItems = planItemsForField && planItemsForField.length > 0;
            const hasTrainingHints = field.key === "sport_events" && trainingHints.length > 0;

            return (
              <div key={field.key}>
                <label className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-secondary">
                  <span className="h-5 w-5 flex-shrink-0 rounded-full bg-primary/10 text-center text-[10px] leading-5 text-primary">
                    {fields.indexOf(field) + 1}
                  </span>
                  {field.label}
                  {autoFilled[field.key] && (
                    <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      авто
                    </span>
                  )}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Норма: <span className="font-medium text-foreground">{field.norm}</span>
                </p>

                {field.type === "number" ? (
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="h-10 w-32"
                  />
                ) : (
                  <>
                    {hasTrainingHints && (
                      <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Подтверждённые тренировки РУСАЛ за период:
                        </div>
                        <ul className="mb-2 space-y-1 text-xs text-muted-foreground">
                          {trainingHints.map((t) => (
                            <li key={t.id} className="flex items-start gap-1.5">
                              <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-500/50" />
                              {formatTrainingShort(t)}
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-emerald-800 hover:text-emerald-900"
                          onClick={() => fillFromTrainings(field.key, trainingHints)}
                        >
                          <ClipboardList className="h-3 w-3" />
                          Заполнить из тренировок
                        </Button>
                      </div>
                    )}
                    {hasPlanItems && (
                      <div className="mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Lightbulb className="h-3.5 w-3.5" />
                          Запланировано на {monthNameRu}:
                        </div>
                        <ul className="mb-2 space-y-1 text-xs text-muted-foreground">
                          {planItemsForField!.map((item) => (
                            <li key={item.id} className="flex items-start gap-1.5">
                              <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary/40" />
                              {formatPlanItemShort(item)}
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-primary hover:text-primary/80"
                          onClick={() => fillFromPlan(field.key, planItemsForField!)}
                        >
                          <ClipboardList className="h-3 w-3" />
                          Заполнить из плана
                        </Button>
                      </div>
                    )}
                    <textarea
                      value={form[field.key] ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={
                        hasPlanItems
                          ? "Нажмите «Заполнить из плана» или введите вручную..."
                          : "Опишите проведённые мероприятия (с указанием дат, места, количества участников)..."
                      }
                      className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      rows={5}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-6">
          <p className="mt-4 text-xs text-muted-foreground/60">
            * — поля, обязательные для заполнения. После отправки отчёт будет проверен руководителем центра.
          </p>
        </div>
      </Card>
    </AppShell>
  );
}