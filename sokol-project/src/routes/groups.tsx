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
  type Athlete,
  type AthleteStatus,
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
  const [quickModal, setQuickModal] = useState<{ mode: "create" | "detail"; groupId?: string } | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate((n) => n + 1);

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
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Состав</label>
                  <button
                    onClick={() => setQuickModal({ mode: "create" })}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3 w-3" /> Новый
                  </button>
                </div>
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Состав ({coachAthletes.length})</label>
                  <button
                    onClick={() => setQuickModal({ mode: "detail", groupId: selected.id })}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3 w-3" /> Добавить
                  </button>
                </div>
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

      {quickModal && (
        <QuickAthleteModal
          groupId={quickModal.mode === "detail" ? quickModal.groupId! : undefined}
          user={user}
          isCoach={isCoach}
          onClose={() => setQuickModal(null)}
          onSaved={(newId) => {
            if (quickModal.mode === "create") {
              setEditAthleteIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
            }
            rerender();
            setQuickModal(null);
          }}
        />
      )}
    </AppShell>
  );
}

const rankOptions = ["КМС", "МС", "МСМК", "ЗМС", "1-й разряд", "2-й разряд", "3-й разряд"];

const calcAge = (birth: string) => {
  if (!birth) return 0;
  const diff = Date.now() - new Date(birth).getTime();
  return Math.floor(diff / 31557600000);
};

function QuickAthleteModal({
  groupId,
  user,
  isCoach,
  onClose,
  onSaved,
}: {
  groupId?: string;
  user: { coachName?: string; coachDiscipline?: string; city?: string } | null;
  isCoach: boolean;
  onClose: () => void;
  onSaved: (newId: string) => void;
}) {
  const [name, setName] = useState("");
  const [rank, setRank] = useState("КМС");
  const [dob, setDob] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    const lastId = athletes
      .map((a) => Number(a.id.replace("SK-", "")))
      .reduce((max, n) => Math.max(max, n), 0);
    const newId = `SK-${String(lastId + 1).padStart(4, "0")}`;
    const newAthlete: Athlete = {
      id: newId,
      name: name.trim(),
      discipline: (user?.coachDiscipline ?? "Дзюдо") as Discipline,
      rank,
      age: calcAge(dob) || 0,
      city: user?.city ?? "",
      coach: user?.coachName ?? "",
      status: "Активный" as AthleteStatus,
      medals: { gold: 0, silver: 0, bronze: 0 },
      rating: 1000,
      lastEvent: "—",
    };
    athletes.push(newAthlete);
    if (groupId) {
      const grp = allGroups.find((g) => g.id === groupId);
      if (grp && !grp.athleteIds.includes(newId)) {
        grp.athleteIds.push(newId);
      }
    }
    onSaved(newId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Новый спортсмен</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван" className="h-9" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Разряд</label>
              <select
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {rankOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата рождения</label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>Дисциплина: <span className="font-medium text-secondary">{user?.coachDiscipline ?? "—"}</span></p>
            <p>Тренер: <span className="font-medium text-secondary">{user?.coachName ?? "—"}</span></p>
            <p>Город: <span className="font-medium text-secondary">{user?.city ?? "—"}</span></p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Отмена</Button>
            <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
              Добавить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
