import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Edit3, Plus, Search, Trash2, Users, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { useCenter } from "@/lib/center";
import { AthleteModal } from "@/components/athlete-modal";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  fetchGroups,
  removeGroupMember,
  updateGroup,
  type GroupDto,
} from "@/lib/api/groups.functions";
import {
  athleteFullName,
  calcAge,
  fetchAthletes,
  type AthleteDto,
} from "@/lib/api/athletes.functions";
import { findCoachByUserId, type CoachDto } from "@/lib/api/coaches.functions";

const disciplineOptions = ["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: "Группы — СОКОЛ" },
      { name: "description", content: "Группы спортсменов: состав, расписание, управление." },
    ],
  }),
  component: GroupsPage,
});

function initBadge(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function pluralGroups(n: number): string {
  const t = n % 10;
  const h = n % 100;
  if (t === 1 && h !== 11) return "группа";
  if (t >= 2 && t <= 4 && (h < 12 || h > 14)) return "группы";
  return "групп";
}

function GroupsPage() {
  const { loading, user } = useAuthGuard();
  const { isCoach, isDirector } = useAuth();
  const { selectedCenterId } = useCenter();

  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [athletes, setAthletes] = useState<AthleteDto[]>([]);
  const [myCoach, setMyCoach] = useState<CoachDto | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"create" | "edit" | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDiscipline, setEditDiscipline] = useState(disciplineOptions[0]);
  const [editAthleteIds, setEditAthleteIds] = useState<string[]>([]);
  const [addModal, setAddModal] = useState<"detail" | "form" | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [groupsRes] = await Promise.all([fetchGroups()]);
      setGroups(groupsRes.items);
      if (isCoach) {
        const coach = await findCoachByUserId(user.id);
        setMyCoach(coach);
        if (coach) {
          const athletesRes = await fetchAthletes({ coachId: coach.id });
          setAthletes(athletesRes.items);
        } else {
          setAthletes([]);
        }
      } else {
        const athletesRes = await fetchAthletes();
        setAthletes(athletesRes.items);
      }
    } finally {
      setDataLoading(false);
    }
  }, [user, isCoach]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleGroups = useMemo(() => {
    if (!user) return [];
    if (isCoach) return groups.filter((g) => g.coach_user_id === user.id);
    if (isDirector && selectedCenterId) {
      return groups.filter((g) => g.center_id === selectedCenterId);
    }
    return groups;
  }, [groups, isCoach, isDirector, selectedCenterId, user]);

  const selected = useMemo(
    () => visibleGroups.find((g) => g.id === selectedId) ?? null,
    [visibleGroups, selectedId],
  );

  const athleteIndex = useMemo(() => {
    const map = new Map<string, AthleteDto>();
    for (const a of athletes) map.set(a.id, a);
    return map;
  }, [athletes]);

  const selectedAthletes = useMemo(() => {
    if (!selected) return [];
    return selected.athlete_ids
      .map((id) => athleteIndex.get(id))
      .filter((a): a is AthleteDto => Boolean(a));
  }, [selected, athleteIndex]);

  const occupiedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) {
      for (const aid of g.athlete_ids) ids.add(aid);
    }
    return ids;
  }, [groups]);

  const handleOpenCreate = () => {
    setEditGroupId(null);
    setEditName("");
    setEditDesc("");
    setEditDiscipline(user?.coachDiscipline ?? disciplineOptions[0]);
    setEditAthleteIds([]);
    setEditMode("create");
  };

  const handleOpenEdit = (g: GroupDto) => {
    setEditGroupId(g.id);
    setEditName(g.name);
    setEditDesc(g.schedule_note ?? "");
    setEditDiscipline(g.sport_type);
    setEditAthleteIds([...g.athlete_ids]);
    setEditMode("edit");
  };

  const handleSave = async () => {
    if (!editName.trim() || !user) return;
    setDataLoading(true);
    try {
      if (editMode === "create") {
        const group = await createGroup({
          name: editName.trim(),
          sport_type: editDiscipline || disciplineOptions[0],
          schedule_note: editDesc.trim() || undefined,
          coach_id: myCoach?.id,
          center_id: myCoach?.center_id ?? user.centerId ?? undefined,
        });
        for (const athleteId of editAthleteIds) {
          await addGroupMember(group.id, { athlete_id: athleteId });
        }
        setSelectedId(group.id);
      } else if (editMode === "edit" && editGroupId) {
        const current = selected?.athlete_ids ?? [];
        await updateGroup(editGroupId, {
          name: editName.trim(),
          sport_type: editDiscipline || disciplineOptions[0],
          schedule_note: editDesc.trim() || undefined,
        });
        const toAdd = editAthleteIds.filter((id) => !current.includes(id));
        const myIds = new Set(athletes.map((a) => a.id));
        const toRemove = current.filter((id) => !editAthleteIds.includes(id) && myIds.has(id));
        for (const athleteId of toAdd) {
          await addGroupMember(editGroupId, { athlete_id: athleteId });
        }
        for (const athleteId of toRemove) {
          await removeGroupMember(editGroupId, athleteId);
        }
        setSelectedId(editGroupId);
      }
    } finally {
      await load();
      setEditMode(null);
      setEditGroupId(null);
    }
  };

  const handleRemoveAthlete = async (groupId: string, athleteId: string) => {
    await removeGroupMember(groupId, athleteId);
    await load();
  };

  const handleDeleteGroup = async (group: GroupDto) => {
    if (!window.confirm(`Удалить группу «${group.name}»? Участники и расписание будут удалены.`)) {
      return;
    }
    await deleteGroup(group.id);
    if (selectedId === group.id) setSelectedId(null);
    await load();
  };

  const handleSelectAthleteInDetail = async (athleteId: string) => {
    if (!selected) return;
    await addGroupMember(selected.id, { athlete_id: athleteId });
    await load();
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
          <p className="text-sm text-muted-foreground">
            {dataLoading ? "" : `${visibleGroups.length} ${pluralGroups(visibleGroups.length)}`}
          </p>
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
          {dataLoading && groups.length === 0 && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          )}
          {!dataLoading && visibleGroups.map((g) => (
            <Card
              key={g.id}
              className={`cursor-pointer border-2 p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40 ${
                selectedId === g.id ? "border-primary" : "border-border"
              }`}
              onClick={() => setSelectedId(g.id === selectedId ? null : g.id)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-secondary">{g.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">{g.schedule_note}</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/5 font-normal text-primary">
                  {g.sport_type}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {g.athlete_count} спортсменов
                </span>
                {!isCoach && (
                  <span>{g.coach_name ? `Тренер: ${g.coach_name}` : "Тренер не назначен"}</span>
                )}
              </div>
            </Card>
          ))}
          {!dataLoading && visibleGroups.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
              {isCoach ? "У вас пока нет групп. Создайте первую." : "Нет групп"}
            </div>
          )}
        </div>

        {/* Detail / Create */}
        {editMode && isCoach && (
          <Card className="shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                {editMode === "edit" && (
                  <button
                    onClick={() => { setEditMode(null); setEditGroupId(null); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h4 className="text-sm font-bold text-secondary">
                  {editMode === "create" ? "Новая группа" : "Редактирование"}
                </h4>
              </div>
              <button
                onClick={() => { setEditMode(null); setEditGroupId(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Название *</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" placeholder="Группа юношей…" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта *</label>
                <select
                  value={editDiscipline}
                  onChange={(e) => setEditDiscipline(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {disciplineOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
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
                <div className="flex items-center justify-between">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Состав</label>
                  <button
                    onClick={() => setAddModal("form")}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3 w-3" /> Новый
                  </button>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">Выберите спортсменов из списка:</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {athletes.map((a) => {
                    const checked = editAthleteIds.includes(a.id);
                    const own = editGroupId
                      ? selected?.athlete_ids.includes(a.id) ?? false
                      : false;
                    const inOther = occupiedIds.has(a.id) && !own;
                    const otherGroupName = inOther
                      ? groups.find((g) => g.athlete_ids.includes(a.id) && g.id !== editGroupId)?.name
                      : null;
                    const left = a.status === "inactive";
                    const disabled = !!inOther || left;
                    const reason = left
                      ? "В архиве"
                      : (inOther ? `В группе: ${otherGroupName ?? "—"}` : "");
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/40 ${
                          disabled ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => {
                            setEditAthleteIds((prev) =>
                              checked ? prev.filter((p) => p !== a.id) : [...prev, a.id],
                            );
                          }}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-secondary">{athleteFullName(a)}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {reason || (a.rank ?? `${calcAge(a.birth_date)} лет`)}
                        </span>
                      </label>
                    );
                  })}
                  {athletes.length === 0 && (
                    <p className="py-2 text-xs text-muted-foreground">Нет спортсменов. Создайте спортсмена сначала.</p>
                  )}
                </div>
              </div>
              <Button onClick={handleSave} disabled={dataLoading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
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
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(selected)}>
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(selected)} className="hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Описание</label>
                <p className="mt-1 text-sm text-foreground">{selected.schedule_note || "—"}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>
                  <span className="text-muted-foreground">Дисциплина:</span>
                  <span className="ml-1 font-medium text-secondary">{selected.sport_type}</span>
                </span>
                {!isCoach && (
                  <span>
                    <span className="text-muted-foreground">Тренер:</span>
                    <span className={`ml-1 font-medium ${selected.coach_name ? "text-secondary" : ""}`}>
                      {selected.coach_name || "не назначен"}
                    </span>
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Расписание</label>
                <p className="mt-1 rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
                  Расписание занятий группы настраивается на странице «Расписание».
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Состав ({selectedAthletes.length})</label>
                  {isCoach && (
                    <button
                      onClick={() => setAddModal("detail")}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      <Plus className="h-3 w-3" /> Добавить
                    </button>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {selectedAthletes.map((a) => (
                    <div key={a.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/30">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-primary-foreground">
                        {initBadge(athleteFullName(a))}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-secondary">{athleteFullName(a)}</div>
                        <div className="text-xs text-muted-foreground">{a.rank ?? `${calcAge(a.birth_date)} лет`}</div>
                      </div>
                      {isCoach && (
                        <button
                          onClick={() => handleRemoveAthlete(selected.id, a.id)}
                          className="ml-auto text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                          title="Удалить из группы"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedAthletes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Нет спортсменов</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {addModal && isCoach && (
        <AddAthleteModal
          candidates={athletes}
          occupiedIds={occupiedIds}
          coachId={myCoach?.id}
          onSelect={(athleteId) => {
            if (addModal === "detail") {
              void handleSelectAthleteInDetail(athleteId);
            } else {
              setEditAthleteIds((prev) => (prev.includes(athleteId) ? prev : [...prev, athleteId]));
            }
          }}
          onAthleteCreated={() => load()}
          onClose={() => setAddModal(null)}
        />
      )}
    </AppShell>
  );
}

function AddAthleteModal({
  candidates,
  occupiedIds,
  coachId,
  onSelect,
  onAthleteCreated,
  onClose,
}: {
  candidates: AthleteDto[];
  occupiedIds: Set<string>;
  coachId?: string;
  onSelect: (athleteId: string) => void;
  onAthleteCreated: () => void;
  onClose: () => void;
}) {
  const [isNewTab, setIsNewTab] = useState(false);
  const [search, setSearch] = useState("");

  const freeAthletes = useMemo(
    () =>
      candidates.filter(
        (a) =>
          !occupiedIds.has(a.id) &&
          a.status !== "inactive",
      ),
    [candidates, occupiedIds],
  );

  const filtered = useMemo(
    () =>
      freeAthletes.filter((a) =>
        athleteFullName(a).toLowerCase().includes(search.toLowerCase()),
      ),
    [freeAthletes, search],
  );

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
              <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="relative">
            <AthleteModal
              athlete={null}
              coachId={coachId}
              onClose={onClose}
              onSaved={() => {
                onAthleteCreated();
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
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
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
                    onClick={() => {
                      onSelect(a.id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted/40"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
                      {initBadge(athleteFullName(a))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-secondary">{athleteFullName(a)}</div>
                      <div className="text-xs text-muted-foreground">{a.rank ?? `${calcAge(a.birth_date)} лет`}</div>
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