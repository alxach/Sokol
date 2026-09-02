import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  athleteFullName,
  athleteStatusLabels,
  calcAge,
  createAthlete,
  updateAthlete,
  type AthleteDto,
  type AthleteStatusKey,
} from "@/lib/api/athletes.functions";
import { rankOptions, NO_RANK } from "@/lib/ranks";

export const disciplines = ["Дзюдо", "Самбо", "Бокс", "ММА", "Борьба"];

const statusOptions: AthleteStatusKey[] = [
  "active",
  "inactive",
];

const LEAVES_GROUPS: AthleteStatusKey[] = ["inactive"];

type AthleteForm = {
  name: string;
  discipline: string;
  rank: string;
  dob: string;
  gender: string;
  status: AthleteStatusKey;
  notes: string;
};

function splitFullName(name: string): { last: string; first: string; middle: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { last: "", first: "", middle: "" };
  if (parts.length === 1) return { last: "", first: parts[0], middle: "" };
  if (parts.length === 2) return { last: parts[0], first: parts[1], middle: "" };
  return { last: parts[0], first: parts[1], middle: parts.slice(2).join(" ") };
}

function formFromAthlete(a: AthleteDto): AthleteForm {
  return {
    name: athleteFullName(a),
    discipline: a.sport_type,
    rank: a.rank ?? NO_RANK,
    dob: a.birth_date,
    gender: a.gender,
    status: (a.status as AthleteStatusKey) || "active",
    notes: a.notes ?? "",
  };
}

export function AthleteModal({
  athlete,
  coachId,
  onClose,
  onSaved,
}: {
  athlete: AthleteDto | null;
  coachId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const isEdit = !!athlete;
  const initial = athlete ? formFromAthlete(athlete) : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [discipline, setDiscipline] = useState(initial?.discipline ?? "Дзюдо");
  const [rank, setRank] = useState(initial?.rank ?? NO_RANK);
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "male");
  const [status, setStatus] = useState<AthleteStatusKey>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Укажите ФИО");
      return;
    }
    const { last, first, middle } = splitFullName(name);
    if (!last || !first) {
      setError("Укажите фамилию и имя (например: Иванов Иван)");
      return;
    }
    if (!dob) {
      setError("Укажите дату рождения");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isEdit && athlete) {
        await updateAthlete(athlete.id, {
          first_name: first,
          last_name: last,
          middle_name: middle || undefined,
          birth_date: dob,
          gender,
          sport_type: discipline,
          rank: rank || undefined,
          status,
          notes: notes || undefined,
        });
      } else {
        await createAthlete({
          first_name: first,
          last_name: last,
          middle_name: middle || undefined,
          birth_date: dob,
          gender,
          sport_type: discipline,
          rank: rank || undefined,
          coach_id: coachId,
          notes: notes || undefined,
        });
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить спортсмена");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">{isEdit ? "Редактировать" : "Новый"} спортсмен</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ФИО *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван Иванович" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Вид спорта</label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {disciplines.map((d) => (
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата рождения *</label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Пол</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>
          </div>
          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AthleteStatusKey)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{athleteStatusLabels[s]}</option>
                ))}
              </select>
              {LEAVES_GROUPS.includes(status) && (
                <p className="mt-1 text-xs text-destructive">
                  Спортсмен будет выведен из всех групп и исчезнет из журнала посещаемости. Данные и история сохранены — его можно восстановить позже.
                </p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Примечание</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" placeholder="Особые отметки" />
          </div>
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="outline" className="flex-1" disabled={saving}>Отмена</Button>
            <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
              {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}