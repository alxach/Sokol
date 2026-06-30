import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users, Calendar, Edit3, X, Search, ArrowLeft, Clock, MapPin, Check, AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { useCenter } from "@/lib/center";
import { AthleteModal } from "@/components/athlete-modal";
import {
  athletes,
  schedules,
  schedulePeriods,
  groups as allGroups,
  getCenterIdByCoachName,
  getPeriodStatus,
  archiveOtherActivePeriods,
  freshSchedulePeriodId,
  freshScheduleId,
  persistSchedulePeriods,
  persistSchedules,
  type Group,
  type Schedule,
  type SchedulePeriod,
  type Discipline,
  type Athlete,
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
  const { isCoach, isDirector } = useAuth();
  const { selectedCenterId } = useCenter();

  const myGroups = useMemo(() => {
    if (!user) return [];
    if (isCoach) return allGroups.filter((g) => g.coachId === user.id);
    if (isDirector && selectedCenterId) return allGroups.filter((g) => getCenterIdByCoachName(g.coachName) === selectedCenterId);
    return allGroups;
  }, [isCoach, isDirector, selectedCenterId, user]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"create" | "edit" | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDiscipline, setEditDiscipline] = useState<Discipline>("Дзюдо");
  const [editAthleteIds, setEditAthleteIds] = useState<string[]>([]);
  const [addModal, setAddModal] = useState<{ groupId: string } | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
  const togglePeriod = (id: string) => setExpandedPeriods((prev) => ({ ...prev, [id]: !prev[id] }));
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate((n) => n + 1);

  const selected = useMemo(
    () => myGroups.find((g) => g.id === selectedId) ?? null,
    [myGroups, selectedId],
  );

  const coachDiscipline = isCoach && user?.coachDiscipline ? user.coachDiscipline : null;

  const myAthletes = useMemo(
    () => athletes.filter((a) => a.coach === user?.coachName),
    [user?.coachName],
  );

  const groupPeriods = useMemo(
    () => (selected ? schedulePeriods.filter((p) => p.group === selected.name) : []),
    [selected],
  );

  const groupSchedules = useMemo(
    () => (selected ? schedules.filter((s) => s.group === selected.name) : []),
    [selected],
  );

  const groupSchedulesByPeriod = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const p of groupPeriods) {
      map.set(p.id, schedules.filter((s) => s.periodId === p.id));
    }
    return map;
  }, [groupPeriods]);

  const groupAthletes = useMemo(
    () => (selected ? athletes.filter((a) => selected.athleteIds.includes(a.id)) : []),
    [selected],
  );

  const handleOpenCreate = () => {
    setEditGroupId(null);
    setEditName("Новая группа");
    setEditDesc("");
    setEditDiscipline((coachDiscipline ?? "Дзюдо") as Discipline);
    setEditAthleteIds([]);
    setEditMode("create");
  };

  const handleOpenEdit = (g: Group) => {
    setEditGroupId(g.id);
    setEditName(g.name);
    setEditDesc(g.description ?? "");
    setEditDiscipline(g.discipline);
    setEditAthleteIds([...g.athleteIds]);
    setEditMode("edit");
  };

  const handleSave = () => {
    if (!editName.trim() || !user) return;
    if (editMode === "create") {
      const lastId = allGroups
        .map((g) => Number(g.id.replace("GRP-", "")))
        .reduce((max, n) => Math.max(max, n), 0);
      const newGroup: Group = {
        id: `GRP-${String(lastId + 1).padStart(3, "0")}`,
        name: editName.trim(),
        discipline: editDiscipline,
        coachId: user.id,
        coachName: user.coachName ?? "",
        athleteIds: editAthleteIds,
        description: editDesc.trim() || undefined,
      };
      allGroups.push(newGroup);
      for (const id of editAthleteIds) {
        const athlete = athletes.find((a) => a.id === id);
        if (athlete) athlete.groupId = newGroup.id;
      }
      setSelectedId(newGroup.id);
    } else if (editMode === "edit" && editGroupId) {
      const grp = allGroups.find((g) => g.id === editGroupId);
      if (!grp) return;
      const removed = grp.athleteIds.filter((id) => !editAthleteIds.includes(id));
      const added = editAthleteIds.filter((id) => !grp.athleteIds.includes(id));
      for (const id of removed) {
        const a = athletes.find((at) => at.id === id);
        if (a) a.groupId = undefined;
      }
      for (const id of added) {
        const a = athletes.find((at) => at.id === id);
        if (a) a.groupId = editGroupId;
      }
      grp.name = editName.trim();
      grp.description = editDesc.trim() || undefined;
      grp.athleteIds = [...editAthleteIds];
    }
    setEditMode(null);
    setEditGroupId(null);
    rerender();
  };

  const handleCancelEdit = () => {
    setEditMode(null);
    setEditGroupId(null);
  };

  const handleRemoveAthlete = (groupId: string, athleteId: string) => {
    const grp = allGroups.find((g) => g.id === groupId);
    if (!grp) return;
    grp.athleteIds = grp.athleteIds.filter((id) => id !== athleteId);
    const athlete = athletes.find((a) => a.id === athleteId);
    if (athlete) athlete.groupId = undefined;
    rerender();
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
          <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
        {editMode && (
          <Card className="shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                {editMode === "edit" && (
                  <button onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h4 className="text-sm font-bold text-secondary">
                  {editMode === "create" ? "Новая группа" : "Редактирование"}
                </h4>
              </div>
              <button onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground">
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
              {isCoach && (
                    <div className="flex items-center justify-between">
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Состав</label>
                      <button
                        onClick={() => setAddModal({ groupId: "" })}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                      >
                        <Plus className="h-3 w-3" /> Новый
                      </button>
                    </div>
                  )}
                  {isCoach && <p className="mb-2 text-xs text-muted-foreground">Выберите спортсменов из списка:</p>}
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {athletes.filter((a) => a.coach === user?.coachName).map((a) => {
                    const checked = editAthleteIds.includes(a.id);
                    const inOtherGroup = a.groupId && a.groupId !== editGroupId;
                    const otherGroupName = inOtherGroup ? allGroups.find((g) => g.id === a.groupId)?.name : null;
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/40 ${
                          inOtherGroup ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!!inOtherGroup}
                          onChange={() => {
                            setEditAthleteIds((prev) =>
                              checked ? prev.filter((id) => id !== a.id) : [...prev, a.id],
                            );
                          }}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-secondary">{a.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {inOtherGroup ? `В группе: ${otherGroupName}` : a.rank}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {editMode === "create" ? "Создать группу" : "Сохранить"}
              </Button>
            </div>
          </Card>
        )}

        {selected && !editMode && (
          <Card className="shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h4 className="text-sm font-bold text-secondary">{selected.name}</h4>
              {isCoach && (
                <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(selected)}>
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              )}
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Расписание</label>
                  {isCoach && (
                    <button
                      onClick={() => setShowPeriodModal(true)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      <Plus className="h-3 w-3" /> Добавить период
                    </button>
                  )}
                </div>
                <div className="mt-1 space-y-2">
                  {groupPeriods.length === 0 && (
                    <p className="text-xs text-muted-foreground">Расписание не задано</p>
                  )}
                  {groupPeriods.map((p) => {
                    const effectiveStatus = getPeriodStatus(p);
                    const pSchedules = groupSchedulesByPeriod.get(p.id) ?? [];
                    const expanded = expandedPeriods[p.id] ?? false;
                    return (
                      <div key={p.id} className="rounded-lg border border-border bg-muted/10">
                        <button
                          onClick={() => togglePeriod(p.id)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-secondary">{p.periodStart} — {p.periodEnd}</span>
                            <PeriodBadge status={effectiveStatus} />
                          </div>
                          <span className="text-muted-foreground">{pSchedules.length} занятий</span>
                        </button>
                        {expanded && (
                          <div className="border-t border-border p-2 space-y-1">
                            {pSchedules.length === 0 && (
                              <p className="py-2 text-center text-xs text-muted-foreground">Нет занятий</p>
                            )}
                            {pSchedules.map((s) => (
                              <div key={s.id} className="group flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5 text-xs">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium text-secondary">{dayNames[s.dayOfWeek - 1]}</span>
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span>{s.timeStart}–{s.timeEnd}</span>
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">{s.room}</span>
                                </div>
                                {isCoach && effectiveStatus === "draft" && (
                                  <button
                                    onClick={() => {
                                      const idx = schedules.findIndex((x) => x.id === s.id);
                                      if (idx !== -1) { schedules.splice(idx, 1); persistSchedules(); rerender(); }
                                    }}
                                    className="ml-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {editingPeriodId === p.id ? (
                              <EditPeriodForm
                                period={p}
                                onClose={() => setEditingPeriodId(null)}
                                onSaved={() => { persistSchedulePeriods(); rerender(); }}
                              />
                            ) : (
                              <div className="flex gap-1 pt-1">
                                {isCoach && effectiveStatus === "draft" && (
                                  <>
                                    <button
                                      onClick={() => setEditingPeriodId(p.id)}
                                      className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    >
                                      Изменить даты
                                    </button>
                                    <button
                                      onClick={() => { archiveOtherActivePeriods(p); p.status = "active"; persistSchedulePeriods(); rerender(); }}
                                      className="rounded-md px-2 py-0.5 text-xs text-[color:var(--success)] hover:bg-[color:var(--success)]/10"
                                    >
                                      <Check className="inline h-3 w-3 mr-0.5" /> Утвердить
                                    </button>
                                    <button
                                      onClick={() => {
                                        const idx = schedulePeriods.findIndex((x) => x.id === p.id);
                                        if (idx !== -1) schedulePeriods.splice(idx, 1);
                                        const toRemove = schedules.filter((x) => x.periodId === p.id);
                                        for (const r of toRemove) {
                                          const ridx = schedules.findIndex((x) => x.id === r.id);
                                          if (ridx !== -1) schedules.splice(ridx, 1);
                                        }
                                        persistSchedulePeriods(); persistSchedules(); rerender();
                                      }}
                                      className="rounded-md px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                      Удалить
                                    </button>
                                  </>
                                )}
                                {effectiveStatus === "active" && isCoach && (
                                  <span className="text-[10px] text-muted-foreground">Утверждено</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Состав ({groupAthletes.length})</label>
                  {isCoach && (
                  <button
                    onClick={() => setAddModal({ groupId: selected.id })}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3 w-3" /> Добавить
                  </button>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {groupAthletes.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/30 group">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-primary-foreground">
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-secondary">{a.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{a.rank}</span>
                      {isCoach && (
                        <button
                          onClick={() => handleRemoveAthlete(selected.id, a.id)}
                          className="ml-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                          title="Удалить из группы"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {groupAthletes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Нет спортсменов</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {showPeriodModal && selected && (
        <CreatePeriodForGroupModal
          groupName={selected.name}
          discipline={selected.discipline}
          coachId={user?.id ?? ""}
          coachName={user?.coachName ?? ""}
          onClose={() => setShowPeriodModal(false)}
          onSaved={() => { persistSchedulePeriods(); persistSchedules(); rerender(); }}
        />
      )}

      {addModal && isCoach && (
        <AddAthleteModal
          groupId={addModal.groupId}
          user={user}
          myAthletes={myAthletes}
          allGroups={allGroups}
          editAthleteIds={editAthleteIds}
          onAddToEditIds={(id) => setEditAthleteIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
          onClose={() => setAddModal(null)}
          onSaved={() => rerender()}
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

function AddAthleteModal({
  groupId,
  user,
  myAthletes,
  allGroups: modalGroups,
  editAthleteIds,
  onAddToEditIds,
  onClose,
  onSaved,
}: {
  groupId: string;
  user: { coachName?: string; coachDiscipline?: string; city?: string } | null;
  myAthletes: Athlete[];
  allGroups: Group[];
  editAthleteIds: string[];
  onAddToEditIds: (id: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isNewTab, setIsNewTab] = useState(false);
  const [search, setSearch] = useState("");

  const freeAthletes = useMemo(
    () => myAthletes.filter((a) => !a.groupId || a.groupId === groupId),
    [myAthletes, groupId],
  );
  const filtered = useMemo(
    () => freeAthletes.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [freeAthletes, search],
  );

  const handleSelectAthlete = (athleteId: string) => {
    if (groupId) {
      const grp = modalGroups.find((g) => g.id === groupId);
      if (!grp) return;
      const athlete = athletes.find((a) => a.id === athleteId);
      if (!athlete) return;
      grp.athleteIds.push(athleteId);
      athlete.groupId = groupId;
      onSaved();
    } else {
      onAddToEditIds(athleteId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {isNewTab ? (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <button onClick={() => setIsNewTab(false)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-bold text-secondary">Новый спортсмен</h3>
            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
            </div>
          </div>
          <div className="relative">
            <AthleteModal
              athlete={null}
              coachName={user?.coachName}
              coachDiscipline={user?.coachDiscipline}
              coachCity={user?.city}
              onClose={onClose}
              onSaved={(newId) => {
                if (!groupId && newId) onAddToEditIds(newId);
                onSaved();
                onClose();
              }}
            />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex gap-3">
              <button
                onClick={() => setIsNewTab(false)}
                className={`text-sm font-medium ${!isNewTab ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Из спортсменов
              </button>
              <button
                onClick={() => setIsNewTab(true)}
                className={`text-sm font-medium ${isNewTab ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Новый
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>

          <div className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по фамилии…"
                className="h-9 pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {search ? "Ничего не найдено" : "Все спортсмены уже распределены по группам"}
                </p>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelectAthlete(a.id)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted/40"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
                      {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-secondary">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.rank}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PeriodBadge({ status }: { status: string }) {
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
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${styles[status] ?? styles.draft}`}>
      {labels[status] ?? status}
    </span>
  );
}

function EditPeriodForm({
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

  const handleSave = () => {
    if (!periodStart || !periodEnd) return;
    period.periodStart = periodStart;
    period.periodEnd = periodEnd;
    onSaved();
    onClose();
  };

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 p-2">
      <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-7 w-[130px] text-xs" />
      <span className="text-xs text-muted-foreground">—</span>
      <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-7 w-[130px] text-xs" />
      <Button size="sm" className="h-7 text-xs" onClick={handleSave}>Сохранить</Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>✕</Button>
    </div>
  );
}

function CreatePeriodForGroupModal({
  groupName,
  discipline,
  coachId,
  coachName,
  onClose,
  onSaved,
}: {
  groupName: string;
  discipline: Discipline;
  coachId: string;
  coachName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const DEFAULT_SLOT = { start: "09:00", end: "10:30", room: "" };
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dayTimes, setDayTimes] = useState<Record<number, { start: string; end: string; room: string }>>({});
  const [defaultRoom, setDefaultRoom] = useState("");

  const days = Object.keys(dayTimes).map(Number);

  const toggleDay = (day: number) => {
    setDayTimes((prev) => {
      if (prev[day]) {
        const { [day]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [day]: { ...DEFAULT_SLOT, room: defaultRoom } };
    });
  };

  const handleCreate = () => {
    if (!periodStart || !periodEnd || days.length === 0) return;
    const periodId = freshSchedulePeriodId();
    schedulePeriods.push({
      id: periodId,
      coachId,
      coachName,
      group: groupName,
      discipline,
      periodStart,
      periodEnd,
      status: "draft",
      createdAt: new Date().toISOString().slice(0, 10),
    });
    for (const day of days) {
      const t = dayTimes[day];
      schedules.push({
        id: freshScheduleId(),
        periodId,
        coachId,
        coachName,
        group: groupName,
        discipline,
        dayOfWeek: day,
        timeStart: t.start,
        timeEnd: t.end,
        room: t.room || "Не указано",
      });
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Новый период · {groupName}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата начала *</label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-9" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата окончания *</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-9" />
            </div>
          </div>
          {(() => {
            const hasActive = schedulePeriods.some(
              (p) => p.group === groupName && getPeriodStatus(p) === "active",
            );
            return hasActive ? (
              <div className="flex items-start gap-2 rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 p-2.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
                <span>У группы уже есть активный период. При утверждении нового, старый будет перемещён в архив.</span>
              </div>
            ) : null;
          })()}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Дни недели *</label>
            <div className="flex flex-wrap gap-1.5">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((name, idx) => {
                const dayNum = idx + 1;
                const active = dayNum in dayTimes;
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDay(dayNum)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            {days.length > 0 && (
              <div className="mt-3 space-y-2">
                {Object.entries(dayTimes)
                  .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([day, slot]) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-7 text-xs font-medium text-muted-foreground">
                        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][Number(day) - 1]}
                      </span>
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={(e) =>
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...prev[Number(day)], start: e.target.value },
                          }))
                        }
                        className="h-8 w-[100px]"
                      />
                      <span className="text-xs text-muted-foreground">—</span>
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={(e) =>
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...prev[Number(day)], end: e.target.value },
                          }))
                        }
                        className="h-8 w-[100px]"
                      />
                      <Input
                        value={slot.room}
                        onChange={(e) =>
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...prev[Number(day)], room: e.target.value },
                          }))
                        }
                        placeholder="Зал"
                        className="h-8 w-[90px]"
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Зал / место</label>
            <Input
              value={defaultRoom}
              onChange={(e) => setDefaultRoom(e.target.value)}
              placeholder="Зал А, спортзал…"
              className="h-9"
            />
          </div>
          <p className="text-[10px] text-muted-foreground -mt-3">
            Новым дням присваивается зал из поля выше. Можно изменить для каждого дня отдельно.
          </p>
          <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Создать период
          </Button>
        </div>
      </div>
    </div>
  );
}
