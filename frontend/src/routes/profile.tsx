import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Save, X, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthGuard } from "@/lib/auth";
import { CoachProfileEditor } from "@/components/coach/CoachProfileEditor";
import { LeaveSection, checkOverlaps } from "@/components/coach/LeaveSection";
import {
  coachStatusTitle,
  fetchMyCoach,
  updateMyCoach,
  type CoachDto,
  type CoachLeaveEntry,
  type CoachUpdatePayload,
} from "@/lib/api/coaches.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Профиль — СОКОЛ" },
      { name: "description", content: "Профиль тренера" },
    ],
  }),
  component: ProfilePage,
});

const statusStyle: Record<string, string> = {
  "Активный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  "Отпуск": "bg-primary/10 text-primary border-primary/30",
  "На больничном": "bg-destructive/10 text-destructive border-destructive/30",
  "Архив": "bg-muted text-muted-foreground border-border",
};

const NOTES_STORAGE_KEY = "sokol_coach_notes";

function loadNotes(coachId: string): string {
  try {
    return JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "{}")[coachId] ?? "";
  } catch {
    return "";
  }
}

function saveNotes(coachId: string, notes: string) {
  let all: Record<string, string> = {};
  try {
    all = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "{}");
  } catch {
    all = {};
  }
  all[coachId] = notes;
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
}

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
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
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

function crossLeaveOverlap(a: CoachLeaveEntry[], b: CoachLeaveEntry[]): string | null {
  const validA = a.filter((x) => x.start_date && x.end_date);
  const validB = b.filter((x) => x.start_date && x.end_date);
  for (const x of validA) {
    for (const y of validB) {
      const sx = new Date(`${x.start_date}T00:00:00`);
      const ex = new Date(`${x.end_date}T00:00:00`);
      const sy = new Date(`${y.start_date}T00:00:00`);
      const ey = new Date(`${y.end_date}T00:00:00`);
      if (sx <= ey && sy <= ex) {
        return `Отпуск (${x.start_date}–${x.end_date}) пересекается с больничным (${y.start_date}–${y.end_date})`;
      }
    }
  }
  return null;
}

function ProfilePage() {
  const { loading, user } = useAuthGuard();
  const [coach, setCoach] = useState<CoachDto | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [editingSection, setEditingSection] = useState<"vacations" | "sick_leaves" | null>(null);
  const [draftVacations, setDraftVacations] = useState<CoachLeaveEntry[]>([]);
  const [draftSickLeaves, setDraftSickLeaves] = useState<CoachLeaveEntry[]>([]);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setCoachLoading(true);
    fetchMyCoach()
      .then((c) => {
        if (cancelled) return;
        setCoach(c);
        setNotes(loadNotes(c.id));
      })
      .catch(() => {
        if (!cancelled) setCoach(null);
      })
      .finally(() => {
        if (!cancelled) setCoachLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const fullName = user?.coachName || "—";
  const initials = initialsOf(fullName);

  const handleNotesSave = () => {
    if (coach) saveNotes(coach.id, notes);
    setNotesEditing(false);
  };

  const handleProfileSave = async (payload: Parameters<typeof updateMyCoach>[0]) => {
    setSaving(true);
    try {
      const updated = await updateMyCoach(payload);
      setCoach(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleProfileCancel = () => {
    setEditing(false);
  };

  const openLeaveSection = (kind: "vacations" | "sick_leaves") => {
    if (!coach) return;
    if (kind === "vacations") {
      const draft = coach.vacations.map((v) => ({ start_date: v.start_date, end_date: v.end_date }));
      if (draft.length === 0) draft.push({ start_date: "", end_date: "" });
      setDraftVacations(draft);
    } else {
      const draft = coach.sick_leaves.map((s) => ({ start_date: s.start_date, end_date: s.end_date }));
      if (draft.length === 0) draft.push({ start_date: "", end_date: "" });
      setDraftSickLeaves(draft);
    }
    setSectionError(null);
    setEditingSection(kind);
  };

  const closeLeaveSection = () => {
    setEditingSection(null);
    setSectionError(null);
  };

  const saveLeaveSection = async (kind: "vacations" | "sick_leaves") => {
    if (!coach) return;
    const draft = kind === "vacations" ? draftVacations : draftSickLeaves;
    const other = kind === "vacations" ? coach.sick_leaves : coach.vacations;
    const cross = crossLeaveOverlap(draft, other);
    if (cross) {
      setSectionError(cross);
      return;
    }
    setSectionSaving(true);
    setSectionError(null);
    try {
      const payload: CoachUpdatePayload =
        kind === "vacations"
          ? { vacations: draft.filter((v) => v.start_date && v.end_date) }
          : { sick_leaves: draft.filter((s) => s.start_date && s.end_date) };
      const updated = await updateMyCoach(payload);
      setCoach(updated);
      setEditingSection(null);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Не удалось сохранить изменения.");
    } finally {
      setSectionSaving(false);
    }
  };

  return (
    <AppShell title="Профиль" subtitle="Личная информация">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-2xl font-bold text-primary-foreground shadow-lg">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold text-secondary">{fullName}</h2>
              <p className="text-sm text-muted-foreground">
                {user?.roles.includes("coach") ? "Тренер" : user?.roles.includes("director") ? "Директор" : user?.roles.includes("admin") ? "Администратор" : "Пользователь"}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {coach?.specialization && (
                  <span className="rounded-full border border-primary/30 bg-primary/5 px-3 py-0.5 text-xs font-medium text-primary">
                    {coach.specialization}
                  </span>
                )}
                {coach && (
                  <Badge variant="outline" className={`font-normal ${statusStyle[coachStatusTitle(coach)]}`}>
                    {coachStatusTitle(coach)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Контакты</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Email</span>
              <div className="mt-0.5 font-medium text-secondary">{user?.email || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Телефон</span>
              <div className="mt-0.5 font-medium text-secondary">{user?.phone || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Центр</span>
              <div className="mt-0.5 font-medium text-secondary">
                {coach?.center_name || "—"}
                {coach?.center_city ? ` (${coach.center_city})` : ""}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Трудоустроен</span>
              <div className="mt-0.5 font-medium text-secondary">
                {coach ? formatDate(coach.hire_date) : "—"}
              </div>
            </div>
          </div>
        </Card>

        {coach ? (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Профессиональные данные</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs text-muted-foreground">Специализация</span>
                <div className="mt-0.5 font-medium text-secondary">{coach.specialization}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Категория / Разряд</span>
                <div className="mt-0.5 font-medium text-secondary">{coach.qualification || "—"}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Стаж</span>
                <div className="mt-0.5 font-medium text-secondary">{yearsSince(coach.hire_date)} лет</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Статус записи</span>
                <div className="mt-0.5">
                  <Badge variant="outline" className={`font-normal ${statusStyle[coachStatusTitle(coach)]}`}>
                    {coachStatusTitle(coach)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs font-semibold text-muted-foreground">Биография</span>
              <div className="mt-1.5 whitespace-pre-wrap text-sm font-medium text-secondary">
                {coach.biography || "—"}
              </div>
            </div>
          </Card>
        ) : (
          !coachLoading && (
            <Card className="p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm text-muted-foreground">
                Тренерский профиль не заполнен. Обратитесь к администратору.
              </p>
            </Card>
          )
        )}

        {coach && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Статистика</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold text-secondary">{coach.groups_count}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Групп</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold text-secondary">{coach.athletes_count}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Спортсменов</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold text-primary">{yearsSince(coach.hire_date)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Лет стажа</div>
              </div>
            </div>
          </Card>
        )}

        {coach && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            {sectionError && editingSection === "vacations" && (
              <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {sectionError}
              </p>
            )}
            <LeaveSection
              title="Отпуск"
              periods={editingSection === "vacations" ? draftVacations : coach.vacations}
              editing={editingSection === "vacations"}
              tone="primary"
              emptyLabel="Нет запланированных отпусков"
              onAdd={() => setDraftVacations((prev) => [...prev, { start_date: "", end_date: "" }])}
              onRemove={(i) => setDraftVacations((prev) => prev.filter((_, j) => j !== i))}
              onUpdate={(i, field, value) =>
                setDraftVacations((prev) => prev.map((p, j) => (j === i ? { ...p, [field]: value } : p)))
              }
              onValidate={(periods) => {
                const err = checkOverlaps(periods);
                if (err) return `Отпуск: ${err}`;
                return crossLeaveOverlap(periods, coach.sick_leaves);
              }}
            />
            {editingSection === "vacations" ? (
              <div className="mt-4 flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" onClick={closeLeaveSection} disabled={sectionSaving}>
                  Отменить
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveLeaveSection("vacations")}
                  disabled={sectionSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {sectionSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Сохранить отпуск
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="mt-4" onClick={() => openLeaveSection("vacations")}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Изменить отпуск
              </Button>
            )}
          </Card>
        )}

        {coach && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            {sectionError && editingSection === "sick_leaves" && (
              <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {sectionError}
              </p>
            )}
            <LeaveSection
              title="Больничный"
              periods={editingSection === "sick_leaves" ? draftSickLeaves : coach.sick_leaves}
              editing={editingSection === "sick_leaves"}
              tone="destructive"
              emptyLabel="Нет записей о больничном"
              onAdd={() => setDraftSickLeaves((prev) => [...prev, { start_date: "", end_date: "" }])}
              onRemove={(i) => setDraftSickLeaves((prev) => prev.filter((_, j) => j !== i))}
              onUpdate={(i, field, value) =>
                setDraftSickLeaves((prev) => prev.map((p, j) => (j === i ? { ...p, [field]: value } : p)))
              }
              onValidate={(periods) => {
                const err = checkOverlaps(periods);
                if (err) return `Больничный: ${err}`;
                return crossLeaveOverlap(coach.vacations, periods);
              }}
            />
            {editingSection === "sick_leaves" ? (
              <div className="mt-4 flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" onClick={closeLeaveSection} disabled={sectionSaving}>
                  Отменить
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveLeaveSection("sick_leaves")}
                  disabled={sectionSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {sectionSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Сохранить больничный
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="mt-4" onClick={() => openLeaveSection("sick_leaves")}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Изменить больничный
              </Button>
            )}
          </Card>
        )}

        {coach && editing && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Редактирование профиля</h3>
              <Button variant="ghost" size="sm" onClick={handleProfileCancel} disabled={saving}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Отменить
              </Button>
            </div>
            <CoachProfileEditor
              coach={coach}
              onSave={handleProfileSave}
              onCancel={handleProfileCancel}
              saving={saving}
            />
          </Card>
        )}

        {coach && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Личные заметки</h3>
              {!notesEditing ? (
                <Button variant="ghost" size="sm" onClick={() => setNotesEditing(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Редактировать
                </Button>
              ) : (
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleNotesSave}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Сохранить
                </Button>
              )}
            </div>
            {notesEditing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Личные заметки (хранятся локально в браузере)..."
                className="min-h-[100px] w-full rounded-lg border border-border bg-background p-3 text-sm text-secondary placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm font-medium text-secondary">
                {notes || "—"}
              </div>
            )}
          </Card>
        )}

        {coach && !editing && (
          <div className="flex justify-end">
            <Button onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Редактировать профиль
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}