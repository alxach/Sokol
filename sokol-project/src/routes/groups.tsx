import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users, Calendar, Edit3, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthGuard, useAuth } from "@/lib/auth";
import {
  groups as allGroups,
  schedules,
  athletes,
  type Group,
  type Schedule,
  type Discipline,
} from "@/lib/mock-data";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: "Группы — СОКОЛ" },
      { name: "description", content: "Группы спортсменов: состав, расписание, управление." },
    ],
  }),
  component: GroupsPage,
});

const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function GroupsPage() {
  const { loading, user } = useAuthGuard();
  const { isCoach } = useAuth();

  const myGroups = useMemo(() => {
    if (!user) return [];
    if (isCoach) return allGroups.filter((g) => g.coachId === user.id);
    return allGroups;
  }, [isCoach, user]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDiscipline, setEditDiscipline] = useState<Discipline>("Дзюдо");
  const [editAthleteIds, setEditAthleteIds] = useState<string[]>([]);

  const selected = useMemo(
    () => myGroups.find((g) => g.id === selectedId) ?? null,
    [myGroups, selectedId],
  );

  const coachDiscipline = isCoach && user?.coachDiscipline ? user.coachDiscipline : null;

  const groupSchedules = useMemo(
    () => (selected ? schedules.filter((s) => s.group === selected.name) : []),
    [selected],
  );

  const coachAthletes = useMemo(
    () => (selected ? athletes.filter((a) => a.coach === selected.coachName) : []),
    [selected],
  );

  const handleCreate = () => {
    setEditName("Новая группа");
    setEditDesc("");
    setEditDiscipline(coachDiscipline ?? "Дзюдо");
    setEditAthleteIds([]);
    setShowCreate(true);
  };

  const handleSave = () => {
    setShowCreate(false);
    setSelectedId(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Группы" subtitle="Управление группами спортсменов">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">
            {isCoach ? "Мои группы" : "Группы"}
          </h2>
          <p className="text-sm text-muted-foreground">{myGroups.length} групп</p>
        </div>
        {isCoach && (
          <Button onClick={handleCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Создать группу
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* List */}
        <div className="space-y-3">
          {myGroups.map((g) => {
            const scheds = schedules.filter((s) => s.group === g.name);
            return (
              <Card
                key={g.id}
                className={`cursor-pointer border-2 p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40 ${
                  selectedId === g.id ? "border-primary" : "border-border"
                }`}
                onClick={() => setSelectedId(g.id === selectedId ? null : g.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-secondary">{g.name}</h3>
                    <p className="text-xs text-muted-foreground">{g.description}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/5 font-normal text-primary">
                    {g.discipline}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {g.athleteIds.length} спортсменов
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {scheds.length} занятий в неделю
                  </span>
                  {scheds.length > 0 && (
                    <span className="text-muted-foreground/60">
                      {scheds.map((s) => `${dayNames[s.dayOfWeek - 1]} ${s.timeStart}`).join(", ")}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
          {myGroups.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
              {isCoach ? "У вас пока нет групп. Создайте первую." : "Нет групп"}
            </div>
          )}
        </div>

        {/* Detail / Create */}
        {showCreate && (
          <Card className="shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h4 className="text-sm font-bold text-secondary">Новая группа</h4>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Название</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
                <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                  {editDiscipline}
                </Badge>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Описание</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                  placeholder="Описание группы…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Состав</label>
                <p className="mb-2 text-xs text-muted-foreground">Выберите спортсменов из списка:</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {athletes.filter((a) => a.coach === user?.coachName).map((a) => {
                    const checked = editAthleteIds.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setEditAthleteIds((prev) =>
                              checked ? prev.filter((id) => id !== a.id) : [...prev, a.id],
                            );
                          }}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-secondary">{a.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{a.rank}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Создать группу
              </Button>
            </div>
          </Card>
        )}

        {selected && !showCreate && (
          <Card className="shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h4 className="text-sm font-bold text-secondary">{selected.name}</h4>
              <Button variant="ghost" size="sm">
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Описание</label>
                <p className="mt-1 text-sm text-foreground">{selected.description || "—"}</p>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Дисциплина:</span>
                <span className="ml-1 font-medium text-secondary">{selected.discipline}</span>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Расписание</label>
                <div className="mt-1 space-y-1">
                  {groupSchedules.length === 0 && (
                    <p className="text-xs text-muted-foreground">Расписание не задано</p>
                  )}
                  {groupSchedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">{dayNames[s.dayOfWeek - 1]}</span>
                      <span className="font-medium text-secondary">{s.timeStart}–{s.timeEnd}</span>
                      <span className="text-xs text-muted-foreground">{s.room}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Состав ({coachAthletes.length})</label>
                <div className="mt-1 space-y-1">
                  {coachAthletes.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/30">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-primary-foreground">
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-secondary">{a.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{a.rank}</span>
                    </div>
                  ))}
                  {coachAthletes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Нет спортсменов</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
