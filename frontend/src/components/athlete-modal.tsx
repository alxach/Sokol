import { useState, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  athletes,
  groups,
  type AthleteStatus,
  type Discipline,
  type Athlete,
  type Group,
} from "@/lib/mock-data";

export const disciplines: ("Все" | Discipline)[] = ["Все", "Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];
export const rankOptions = ["КМС", "МС", "МСМК", "ЗМС", "1-й разряд", "2-й разряд", "3-й разряд"];
export const statusOptions: AthleteStatus[] = ["Активный", "Травма", "Резерв"];

const calcAge = (birth: string) => {
  if (!birth) return 0;
  const diff = Date.now() - new Date(birth).getTime();
  return Math.floor(diff / 31557600000);
};

function syncGroup(athleteId: string, oldGroupId: string | undefined, newGroupId: string) {
  if (oldGroupId && oldGroupId !== newGroupId) {
    const oldGroup = groups.find((g) => g.id === oldGroupId);
    if (oldGroup) {
      oldGroup.athleteIds = oldGroup.athleteIds.filter((id) => id !== athleteId);
    }
  }
  const newGroup = groups.find((g) => g.id === newGroupId);
  if (newGroup && !newGroup.athleteIds.includes(athleteId)) {
    newGroup.athleteIds.push(athleteId);
  }
}

export function AthleteModal({
  athlete,
  coachName,
  coachDiscipline,
  coachCity,
  onClose,
  onSaved,
}: {
  athlete: Athlete | null;
  coachName?: string;
  coachDiscipline?: string;
  coachCity?: string;
  onClose: () => void;
  onSaved?: (newId?: string) => void;
}) {
  const isEdit = !!athlete;
  const [name, setName] = useState(athlete?.name ?? "");
  const [discipline, setDiscipline] = useState<Discipline>((athlete?.discipline ?? coachDiscipline ?? "Дзюдо") as Discipline);
  const [rank, setRank] = useState(athlete?.rank ?? "КМС");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState(athlete?.city ?? coachCity ?? "");
  const [status, setStatus] = useState<AthleteStatus>(athlete?.status ?? "Активный");
  const [coach, setCoach] = useState(athlete?.coach ?? coachName ?? "");
  const [groupId, setGroupId] = useState(athlete?.groupId ?? "");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const availableGroups = useMemo(
    () => groups.filter((g) => g.coachName === (coachName || coach)),
    [coachName, coach],
  );

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const lastId = groups
      .map((g) => Number(g.id.replace("GRP-", "")))
      .reduce((max, n) => Math.max(max, n), 0);
    const newId = `GRP-${String(lastId + 1).padStart(3, "0")}`;
    const newGroup: Group = {
      id: newId,
      name: newGroupName.trim(),
      discipline: (coachDiscipline ?? discipline) as Discipline,
      coachId: "2",
      coachName: coachName || coach,
      athleteIds: [],
    };
    groups.push(newGroup);
    setGroupId(newId);
    setShowCreateGroup(false);
    setNewGroupName("");
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (isEdit && athlete) {
      const oldGroupId = athlete.groupId;
      Object.assign(athlete, {
        name: name.trim(),
        discipline,
        rank,
        age: calcAge(dob) || athlete.age,
        city: city.trim(),
        status,
        coach: coach.trim(),
        groupId: groupId || undefined,
      });
      if (groupId && groupId !== oldGroupId) {
        syncGroup(athlete.id, oldGroupId, groupId);
      }
      onSaved?.();
    } else {
      const lastId = athletes
        .map((a) => Number(a.id.replace("SK-", "")))
        .reduce((max, n) => Math.max(max, n), 0);
      const newId = `SK-${String(lastId + 1).padStart(4, "0")}`;
      const newAthlete: Athlete = {
        id: newId,
        name: name.trim(),
        discipline,
        rank: rank || "КМС",
        age: calcAge(dob) || 0,
        city: city.trim() || "Не указано",
        coach: coach.trim(),
        status,
        medals: { gold: 0, silver: 0, bronze: 0 },
        rating: 1000,
        lastEvent: "—",
      };
      athletes.push(newAthlete);
      if (groupId) {
        newAthlete.groupId = groupId;
        syncGroup(newId, undefined, groupId);
      }
      onSaved?.(newId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">{isEdit ? "Редактировать" : "Новый"} спортсмен</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as Discipline)}
                disabled={!!coachDiscipline}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              >
                {disciplines.filter((d) => d !== "Все").map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата рождения</label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Город</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" className="h-9" disabled={!!coachCity} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AthleteStatus)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Тренер</label>
              <Input
                value={coach}
                onChange={(e) => setCoach(e.target.value)}
                placeholder="Фамилия И.О."
                className="h-9"
                disabled={!!coachName}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа</label>
            {showCreateGroup ? (
              <div className="space-y-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Название группы"
                  className="h-9"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateGroup}
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Создать
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowCreateGroup(false); setNewGroupName(""); }}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Без группы</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.discipline})</option>
                  ))}
                </select>
                {coachName && (
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    title="Создать группу"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Создать
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="outline" className="flex-1">Отмена</Button>
            <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
              {isEdit ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
