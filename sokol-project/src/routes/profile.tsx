import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Pencil, Plus, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthGuard } from "@/lib/auth";
import { coaches, getCoachStatus, type Coach, type VacationPeriod, isOnVacation, isOnSickLeave } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

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
};

const VACATION_STORAGE_KEY = "sokol_coach_vacations";
const SICK_STORAGE_KEY = "sokol_coach_sick_leaves";

function loadVacationOverrides(): Record<string, VacationPeriod[]> {
  try {
    return JSON.parse(localStorage.getItem(VACATION_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveVacationOverrides(coachId: string, vacations: VacationPeriod[]) {
  const all = loadVacationOverrides();
  if (vacations.length > 0) {
    all[coachId] = vacations;
  } else {
    delete all[coachId];
  }
  localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify(all));
}

function loadSickOverrides(): Record<string, VacationPeriod[]> {
  try {
    return JSON.parse(localStorage.getItem(SICK_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSickOverrides(coachId: string, sickLeaves: VacationPeriod[]) {
  const all = loadSickOverrides();
  if (sickLeaves.length > 0) {
    all[coachId] = sickLeaves;
  } else {
    delete all[coachId];
  }
  localStorage.setItem(SICK_STORAGE_KEY, JSON.stringify(all));
}

function ProfilePage() {
  const { loading, user } = useAuthGuard();
  const [editing, setEditing] = useState(false);
  const [vacationEditing, setVacationEditing] = useState(false);
  const [sickLeaveEditing, setSickLeaveEditing] = useState(false);

  const coachProfile = user?.coachName
    ? coaches.find((c) => c.name === user.coachName)
    : null;

  const override = coachProfile ? loadVacationOverrides()[coachProfile.id] : null;
  const effectiveVacations: VacationPeriod[] = override ?? coachProfile?.vacations ?? [];

  const sickOverride = coachProfile ? loadSickOverrides()[coachProfile.id] : null;
  const effectiveSickLeaves: VacationPeriod[] = sickOverride ?? coachProfile?.sickLeaves ?? [];

  const [vacations, setVacations] = useState<VacationPeriod[]>(effectiveVacations.map((v) => ({ ...v })));
  const [sickLeaves, setSickLeaves] = useState<VacationPeriod[]>(effectiveSickLeaves.map((s) => ({ ...s })));

  useEffect(() => {
    setVacations(effectiveVacations.map((v) => ({ ...v })));
  }, [coachProfile?.id]);

  useEffect(() => {
    setSickLeaves(effectiveSickLeaves.map((s) => ({ ...s })));
  }, [coachProfile?.id]);

  const effectiveCoach: Coach | null = coachProfile
    ? { ...coachProfile, vacations: effectiveVacations, sickLeaves: effectiveSickLeaves }
    : null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const initials = user?.coachName
    ? user.coachName.split(" ").map((n) => n[0]).join("").slice(0, 2)
    : "??";

  const handleSave = () => {
    if (coachProfile) {
      saveVacationOverrides(coachProfile.id, vacations);
      saveSickOverrides(coachProfile.id, sickLeaves);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setVacations(effectiveVacations.map((v) => ({ ...v })));
    setSickLeaves(effectiveSickLeaves.map((s) => ({ ...s })));
    setEditing(false);
  };

  const handleVacationSave = () => {
    if (coachProfile) {
      saveVacationOverrides(coachProfile.id, vacations);
    }
    setVacationEditing(false);
  };

  const handleVacationCancel = () => {
    setVacations(effectiveVacations.map((v) => ({ ...v })));
    setVacationEditing(false);
  };

  const handleSickLeaveSave = () => {
    if (coachProfile) {
      saveSickOverrides(coachProfile.id, sickLeaves);
    }
    setSickLeaveEditing(false);
  };

  const handleSickLeaveCancel = () => {
    setSickLeaves(effectiveSickLeaves.map((s) => ({ ...s })));
    setSickLeaveEditing(false);
  };

  const updateVacation = (index: number, field: "start" | "end", value: string) => {
    setVacations((prev) => {
      const next = prev.map((v) => ({ ...v }));
      next[index][field] = value;
      return next;
    });
  };

  const addVacation = () => {
    setVacations((prev) => [...prev, { start: "", end: "" }]);
  };

  const removeVacation = (index: number) => {
    setVacations((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSickLeave = (index: number, field: "start" | "end", value: string) => {
    setSickLeaves((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next[index][field] = value;
      return next;
    });
  };

  const addSickLeave = () => {
    setSickLeaves((prev) => [...prev, { start: "", end: "" }]);
  };

  const removeSickLeave = (index: number) => {
    setSickLeaves((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <AppShell title="Профиль" subtitle="Личная информация">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Avatar + Name + Edit button */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-2xl font-bold text-primary-foreground shadow-lg">
                {initials}
              </div>
              <div className="text-center sm:text-left">
                <h2 className="font-display text-xl font-bold text-secondary">{user?.coachName || "—"}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="mt-1 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span className="rounded-full border border-primary/30 bg-primary/5 px-3 py-0.5 text-xs font-medium text-primary">
                    {user?.coachDiscipline || "—"}
                  </span>
                  <span className="rounded-full border border-border bg-muted/30 px-3 py-0.5 text-xs text-muted-foreground">
                    {coachProfile?.city || user?.city || "—"}
                  </span>
                </div>
              </div>
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Редактировать
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>Отменить</Button>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>Сохранить</Button>
              </div>
            )}
          </div>
        </Card>

        {/* Contact Info */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Контакты</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Телефон</span>
              <div className="mt-0.5 font-medium text-secondary">{coachProfile?.phone || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Email</span>
              <div className="mt-0.5 font-medium text-secondary">{coachProfile?.email || user?.email || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Telegram</span>
              <div className="mt-0.5 font-medium text-secondary">{coachProfile?.telegram || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Город</span>
              <div className="mt-0.5 font-medium text-secondary">{coachProfile?.city || user?.city || "—"}</div>
            </div>
          </div>
        </Card>

        {/* Professional Info */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Профессиональные данные</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Специализация</span>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                {(coachProfile?.disciplines || [user?.coachDiscipline].filter(Boolean)).map((d) => (
                  <span key={d} className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Категория / Разряд</span>
              <div className="mt-0.5 font-medium text-secondary">{coachProfile?.rank || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Стаж</span>
              <div className="mt-0.5 font-medium text-secondary">{coachProfile?.experience ? `${coachProfile.experience} лет` : "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Образование</span>
              <div className="mt-0.5 font-medium text-secondary">{coachProfile?.education || "—"}</div>
            </div>
          </div>
        </Card>

        {/* Vacation */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Отпуск</h3>
            <div className="flex items-center gap-2">
              {(editing || vacationEditing) && (
                <Button variant="outline" size="sm" onClick={addVacation}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Добавить период
                </Button>
              )}
              {!editing && !vacationEditing && effectiveCoach && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVacationEditing(true)} title="Редактировать отпуск">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {effectiveCoach && (
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle[getCoachStatus(effectiveCoach)]}`}>
                  {isOnVacation(effectiveCoach.vacations) ? "В отпуске" : "Работает"}
                </span>
              )}
            </div>
          </div>
          {vacationEditing && !editing && (
            <div className="mb-4 flex gap-2">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleVacationSave}>Сохранить</Button>
              <Button variant="outline" size="sm" onClick={handleVacationCancel}>Отменить</Button>
            </div>
          )}
          {vacations.length === 0 && !editing && !vacationEditing && (
            <p className="text-sm text-muted-foreground">Нет запланированных отпусков</p>
          )}
          <div className="space-y-4">
            {vacations.map((v, i) => {
              const parsedS = v.start ? new Date(v.start + "T00:00:00") : undefined;
              const parsedE = v.end ? new Date(v.end + "T00:00:00") : undefined;
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground">С</span>
                      {(editing || vacationEditing) ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "mt-0.5 h-9 w-full justify-start text-left font-normal",
                                !v.start && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {v.start ? format(parsedS!, "d MMM yyyy", { locale: ru }) : "Выберите дату"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parsedS}
                              onSelect={(date) => {
                                if (date) updateVacation(i, "start", format(date, "yyyy-MM-dd"));
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="mt-0.5 font-medium text-secondary">
                          {v.start ? format(parsedS!, "d MMM yyyy", { locale: ru }) : "—"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground">По</span>
                      {(editing || vacationEditing) ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "mt-0.5 h-9 w-full justify-start text-left font-normal",
                                !v.end && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {v.end ? format(parsedE!, "d MMM yyyy", { locale: ru }) : "Выберите дату"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parsedE}
                              onSelect={(date) => {
                                if (date) updateVacation(i, "end", format(date, "yyyy-MM-dd"));
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="mt-0.5 font-medium text-secondary">
                          {v.end ? format(parsedE!, "d MMM yyyy", { locale: ru }) : "—"}
                        </div>
                      )}
                    </div>
                  </div>
                  {(editing || vacationEditing) && (
                    <Button variant="ghost" size="icon" className="mt-5 h-9 w-9 shrink-0" onClick={() => removeVacation(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Sick Leave */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Больничный</h3>
            <div className="flex items-center gap-2">
              {(editing || sickLeaveEditing) && (
                <Button variant="outline" size="sm" onClick={addSickLeave}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Добавить период
                </Button>
              )}
              {!editing && !sickLeaveEditing && effectiveCoach && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSickLeaveEditing(true)} title="Редактировать больничный">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {effectiveCoach && (
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle[getCoachStatus(effectiveCoach)]}`}>
                  {isOnSickLeave(effectiveCoach.sickLeaves) ? "На больничном" : "Здоров"}
                </span>
              )}
            </div>
          </div>
          {sickLeaveEditing && !editing && (
            <div className="mb-4 flex gap-2">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSickLeaveSave}>Сохранить</Button>
              <Button variant="outline" size="sm" onClick={handleSickLeaveCancel}>Отменить</Button>
            </div>
          )}
          {sickLeaves.length === 0 && !editing && !sickLeaveEditing && (
            <p className="text-sm text-muted-foreground">Нет записей о больничном</p>
          )}
          <div className="space-y-4">
            {sickLeaves.map((s, i) => {
              const parsedS = s.start ? new Date(s.start + "T00:00:00") : undefined;
              const parsedE = s.end ? new Date(s.end + "T00:00:00") : undefined;
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground">С</span>
                      {(editing || sickLeaveEditing) ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "mt-0.5 h-9 w-full justify-start text-left font-normal",
                                !s.start && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {s.start ? format(parsedS!, "d MMM yyyy", { locale: ru }) : "Выберите дату"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parsedS}
                              onSelect={(date) => {
                                if (date) updateSickLeave(i, "start", format(date, "yyyy-MM-dd"));
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="mt-0.5 font-medium text-secondary">
                          {s.start ? format(parsedS!, "d MMM yyyy", { locale: ru }) : "—"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground">По</span>
                      {(editing || sickLeaveEditing) ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "mt-0.5 h-9 w-full justify-start text-left font-normal",
                                !s.end && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {s.end ? format(parsedE!, "d MMM yyyy", { locale: ru }) : "Выберите дату"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parsedE}
                              onSelect={(date) => {
                                if (date) updateSickLeave(i, "end", format(date, "yyyy-MM-dd"));
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="mt-0.5 font-medium text-secondary">
                          {s.end ? format(parsedE!, "d MMM yyyy", { locale: ru }) : "—"}
                        </div>
                      )}
                    </div>
                  </div>
                  {(editing || sickLeaveEditing) && (
                    <Button variant="ghost" size="icon" className="mt-5 h-9 w-9 shrink-0" onClick={() => removeSickLeave(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Stats */}
        {coachProfile && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Статистика</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold text-secondary">{coachProfile.groups}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Групп</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold text-secondary">{coachProfile.athletes}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Спортсменов</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold text-primary">{coachProfile.efficiency}%</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Эффективность</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
