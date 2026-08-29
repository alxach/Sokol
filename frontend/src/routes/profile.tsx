import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthGuard } from "@/lib/auth";
import {
  coachStatusTitle,
  findCoachByUserId,
} from "@/lib/api/coaches.functions";
import type { CoachDto } from "@/lib/api/coaches.functions";

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

function ProfilePage() {
  const { loading, user } = useAuthGuard();
  const [coach, setCoach] = useState<CoachDto | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setCoachLoading(true);
    findCoachByUserId(user.id)
      .then((c) => {
        if (cancelled || !c) return;
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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Отпуск</h3>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                coachHasActivePeriod(coach.vacations)
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
              }`}>
                {coachHasActivePeriod(coach.vacations) ? "В отпуске" : "Работает"}
              </span>
            </div>
            {coach.vacations.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Нет запланированных отпусков</p>
            ) : (
              <div className="mt-3 space-y-2">
                {coach.vacations.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <span className="text-sm">
                      <span className="text-muted-foreground">С </span>
                      <span className="font-medium text-secondary">{formatDate(v.start_date)}</span>
                      <span className="text-muted-foreground"> по </span>
                      <span className="font-medium text-secondary">{formatDate(v.end_date)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {coach && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Больничный</h3>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                coachHasActivePeriod(coach.sick_leaves)
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
              }`}>
                {coachHasActivePeriod(coach.sick_leaves) ? "На больничном" : "Здоров"}
              </span>
            </div>
            {coach.sick_leaves.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Нет записей о больничном</p>
            ) : (
              <div className="mt-3 space-y-2">
                {coach.sick_leaves.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <span className="text-sm">
                      <span className="text-muted-foreground">С </span>
                      <span className="font-medium text-secondary">{formatDate(s.start_date)}</span>
                      <span className="text-muted-foreground"> по </span>
                      <span className="font-medium text-secondary">{formatDate(s.end_date)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
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
      </div>
    </AppShell>
  );
}

function coachHasActivePeriod(periods: { start_date: string; end_date: string }[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return periods.some((p) => {
    const start = new Date(`${p.start_date}T00:00:00`);
    const end = new Date(`${p.end_date}T00:00:00`);
    return start <= today && today <= end;
  });
}