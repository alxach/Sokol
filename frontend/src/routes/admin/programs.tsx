import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fetchCenters, type Center } from "@/lib/api/organizations.functions";
import {
  fetchCriteria, saveCriteria, DEFAULT_CRITERIA,
  fetchCoachTiers, setCoachTier,
  type CoachTier, type CoachTierRecord,
  type IncentiveCriteria, type IncentiveCriteriaPayload,
} from "@/lib/api/criteria.functions";

export const Route = createFileRoute("/admin/programs")({
  head: () => ({
    meta: [
      { title: "Программы стимулирования — СОКОЛ" },
      { name: "description", content: "Положения, тиры и критерии материального стимулирования." },
    ],
  }),
  component: AdminProgramsPage,
});

interface Program {
  id: string;
  name: string;
  regulation_number: string;
  regulation_date: string;
  revision: number;
  max_payout: number;
  min_payout: number;
  ndfl_rate: number;
  insurance_rate: number;
  is_discretionary: boolean;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "Активна",
  archived: "Архив",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  active: "bg-green-100 text-green-800 border-green-200",
  archived: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const NUMBER_FORMAT = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.message) as { detail?: string };
      if (body.detail) return body.detail;
    } catch {
      /* raw text */
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Ошибка";
}

const CRITERIA_ROWS: {
  fullKey: keyof IncentiveCriteriaPayload;
  basicKey: keyof IncentiveCriteriaPayload;
  label: string;
  unit: string;
  step: string;
}[] = [
  { fullKey: "athletes_full", basicKey: "athletes_basic", label: "Спортсмены до 21 года на безвозмездной основе", unit: "чел.", step: "1" },
  { fullKey: "hours_full", basicKey: "hours_basic", label: "Часы занятий со спортсменами до 21 года", unit: "ч/нед", step: "0.5" },
  { fullKey: "social_events_full", basicKey: "social_events_basic", label: "Мероприятия с особыми категориями населения (дети с ОВЗ, школы)", unit: "меропр./мес", step: "1" },
  { fullKey: "sports_events_full", basicKey: "sports_events_basic", label: "Спортивные мероприятия (соревнования, сборы, мастер-классы)", unit: "меропр./мес", step: "1" },
  { fullKey: "development_events_full", basicKey: "development_events_basic", label: "Мероприятия на развитие спортсменов (беседы, лекции)", unit: "меропр./мес", step: "1" },
];

function ProgramsTable({
  programs, loading, canManage, onEdit, onCreate, onQuickStatus, error,
}: {
  programs: Program[];
  loading: boolean;
  canManage: boolean;
  onEdit: (p: Program) => void;
  onCreate: () => void;
  onQuickStatus: (p: Program, status: string) => void;
  error: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Положения о материальном стимулировании</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {programs.length} программ{canManage ? " · редактирование доступно только руководителю" : ""}
          </p>
        </div>
        {canManage && (
          <Button onClick={onCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Новая программа
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Положение</TableHead>
              <TableHead>Ред.</TableHead>
              <TableHead>Вилка выплат</TableHead>
              <TableHead>Ставки</TableHead>
              <TableHead>Статус</TableHead>
              {canManage && <TableHead className="w-24 text-right">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Загрузка…</TableCell></TableRow>
            ) : programs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Нет программ</TableCell></TableRow>
            ) : programs.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.regulation_number}
                  <span className="block text-xs">{p.regulation_date}</span>
                </TableCell>
                <TableCell className="text-sm">{p.revision}</TableCell>
                <TableCell className="text-sm">
                  {NUMBER_FORMAT.format(p.min_payout)} — {NUMBER_FORMAT.format(p.max_payout)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  НДФЛ {p.ndfl_rate}% · взносы {p.insurance_rate}%
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${STATUS_COLORS[p.status] ?? ""}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактировать" onClick={() => onEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {p.status === "draft" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" title="Активировать" onClick={() => onQuickStatus(p, "active")}>
                          Активировать
                        </Button>
                      )}
                      {p.status === "active" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" title="В архив" onClick={() => onQuickStatus(p, "archived")}>
                          В архив
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function parseNum(v: string): number | null {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const TIER_LABELS: Record<CoachTier, string> = {
  full: "Полный",
  basic: "Базовый",
};

function CoachTiersCard({ centerId }: { centerId: string }) {
  const [tiers, setTiers] = useState<CoachTierRecord[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CoachTier>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTiers(null);
    setDrafts({});
    (async () => {
      try {
        const data = await fetchCoachTiers(centerId);
        if (!cancelled) setTiers(data);
      } catch (err) {
        if (!cancelled) setMsg({ kind: "err", text: apiErrorMessage(err) });
      }
    })();
    return () => { cancelled = true; };
  }, [centerId]);

  const selectedOf = (r: CoachTierRecord): string =>
    drafts[r.coach_id] ?? r.tier ?? "";

  const dirtyOf = (r: CoachTierRecord): boolean =>
    (drafts[r.coach_id] ?? r.tier) !== r.tier;

  const save = async (r: CoachTierRecord, tier: CoachTier) => {
    setSavingId(r.coach_id);
    setMsg(null);
    try {
      const updated = await setCoachTier(r.coach_id, tier);
      setTiers((prev) =>
        (prev ?? []).map((t) => (t.coach_id === updated.coach_id ? updated : t)),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[r.coach_id];
        return next;
      });
      setMsg({ kind: "ok", text: `Тир «${TIER_LABELS[tier]}» сохранён для ${updated.coach_name}` });
    } catch (err) {
      setMsg({ kind: "err", text: apiErrorMessage(err) });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Назначение выплат тренерам</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Руководитель центра задаёт каждому тренеру базовый или полный тир. Сумма и нормы отчёта зависят от назначенного тира.
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-3 text-sm border-b ${msg.kind === "ok" ? "bg-green-100 text-green-800" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </div>
      )}

      <div className="overflow-x-auto">
        {tiers === null ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">Загрузка тренеров…</div>
        ) : tiers.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">В этом центре пока нет тренеров</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Тренер</th>
                <th className="px-4 py-3 font-medium w-44">Тир выплаты</th>
                <th className="px-4 py-3 font-medium w-32 text-right">Действие</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((r) => (
                <tr key={r.coach_id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.coach_name || r.user_id}</span>
                    {r.specialization && <span className="block text-xs text-muted-foreground">{r.specialization}</span>}
                    {!r.tier && !drafts[r.coach_id] && (
                      <Badge variant="outline" className="mt-1 text-xs bg-amber-50 text-amber-700 border-amber-200">
                        не назначено
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RadioGroup
                      className="flex gap-4"
                      value={selectedOf(r)}
                      onValueChange={(v) => {
                        if (v === "full" || v === "basic") {
                          setDrafts((prev) => ({ ...prev, [r.coach_id]: v }));
                        }
                      }}
                    >
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <RadioGroupItem value="full" />
                        Полный
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <RadioGroupItem value="basic" />
                        Базовый
                      </label>
                    </RadioGroup>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant={dirtyOf(r) ? "default" : "outline"}
                        disabled={!dirtyOf(r) || savingId !== null}
                        onClick={() => drafts[r.coach_id] && save(r, drafts[r.coach_id]!)}
                      >
                        {savingId === r.coach_id ? "Сохранение…" : "Сохранить"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function CriteriaTab() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const isDirector = currentUser?.roles.includes("director") ?? false;
  const isSuperadmin = currentUser?.roles.includes("superadmin") ?? false;
  const fixedCenterId = currentUser?.centerId;

  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [activeRange, setActiveRange] = useState<string>("");

  const [form, setForm] = useState<IncentiveCriteriaPayload>({ ...DEFAULT_CRITERIA });
  const [savedCenter, setSavedCenter] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cs, programs] = await Promise.all([
          fetchCenters(),
          apiFetch<Program[]>("/incentive/programs").catch(() => []),
        ]);
        if (cancelled) return;
        setCenters(cs);
        const active = programs.find((p) => p.status === "active");
        if (active) {
          setActiveRange(`${NUMBER_FORMAT.format(active.min_payout)} — ${NUMBER_FORMAT.format(active.max_payout)}`);
        }
        if (!isAdmin && cs.length > 0) {
          setSelectedCenterId(cs[0].id);
        } else if (isAdmin && fixedCenterId) {
          setSelectedCenterId(fixedCenterId);
        }
      } catch (err) {
        if (!cancelled) setMsg({ kind: "err", text: apiErrorMessage(err) });
      } finally {
        if (!cancelled) setLoadingForm(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, fixedCenterId]);

  useEffect(() => {
    if (!selectedCenterId) return;
    let cancelled = false;
    setLoadingForm(true);
    (async () => {
      try {
        const list = await fetchCriteria(selectedCenterId);
        if (cancelled) return;
        const rec: IncentiveCriteria | undefined = list[0];
        if (rec) {
          setForm({
            athletes_full: rec.athletes_full,
            athletes_basic: rec.athletes_basic,
            hours_full: rec.hours_full,
            hours_basic: rec.hours_basic,
            social_events_full: rec.social_events_full,
            social_events_basic: rec.social_events_basic,
            sports_events_full: rec.sports_events_full,
            sports_events_basic: rec.sports_events_basic,
            development_events_full: rec.development_events_full,
            development_events_basic: rec.development_events_basic,
          });
          setSavedCenter(selectedCenterId);
        } else {
          setForm({ ...DEFAULT_CRITERIA });
          setSavedCenter(null);
        }
      } catch (err) {
        if (!cancelled) setMsg({ kind: "err", text: apiErrorMessage(err) });
      } finally {
        if (!cancelled) setLoadingForm(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCenterId]);

  const setField = (key: keyof IncentiveCriteriaPayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!selectedCenterId) return;
    setMsg(null);
    const payload: IncentiveCriteriaPayload = { ...form };
    let invalid = "";
    for (const row of CRITERIA_ROWS) {
      const full = parseNum(String(payload[row.fullKey]));
      const basic = parseNum(String(payload[row.basicKey]));
      if (full === null || basic === null) {
        invalid = "Проверьте числовые значения критериев";
        break;
      }
      if (Number(basic) > Number(full)) {
        invalid = `${row.label}: базовый уровень не может превышать полный`;
        break;
      }
      payload[row.fullKey] = Number(full);
      payload[row.basicKey] = Number(basic);
    }
    if (invalid) {
      setMsg({ kind: "err", text: invalid });
      return;
    }
    setSaving(true);
    try {
      await saveCriteria(selectedCenterId, payload);
      setForm(payload);
      setSavedCenter(selectedCenterId);
      setMsg({ kind: "ok", text: "Критерии утверждены и сохранены" });
    } catch (err) {
      setMsg({ kind: "err", text: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const centerNameOf = (id: string) => centers.find((c) => c.id === id)?.name ?? id;

  if (isAdmin && !fixedCenterId) {
    return (
      <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Для утверждения критериев к вашему профилю должен быть привязан центр. Обратитесь к руководителю.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Критерии материального стимулирования</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Утверждаются руководителем центра или руководителем центров. Тренеры видят только выполнение.
          </p>
        </div>
        {isDirector || isSuperadmin ? (
          <div className="w-72">
            <Label className="text-xs">Центр</Label>
            <Select value={selectedCenterId ?? ""} onValueChange={setSelectedCenterId}>
              <SelectTrigger><SelectValue placeholder="Выберите центр" /></SelectTrigger>
              <SelectContent>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          centers.length > 0 && selectedCenterId && (
            <div className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
              Ваш центр: <span className="font-medium text-foreground">{centerNameOf(selectedCenterId)}</span>
            </div>
          )
        )}
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.kind === "ok" ? "bg-green-100 text-green-800" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </div>
      )}

      {!selectedCenterId ? (
        <Card>
          <div className="p-8 text-center text-muted-foreground">
            {loadingForm ? "Загрузка…" : "Нет доступных центров"}
          </div>
        </Card>
      ) : (
        <>
        <Card>
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Показатель (что учитывается)</th>
                  <th className="px-4 py-3 font-medium w-36">Полный (50 К)</th>
                  <th className="px-4 py-3 font-medium w-36">Базовый (25 К)</th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA_ROWS.map((row) => (
                  <tr key={row.fullKey} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.label}</span>
                      <span className="block text-xs text-muted-foreground">ед.: {row.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step={row.step}
                        min="0"
                        value={String(form[row.fullKey])}
                        onChange={(e) => setField(row.fullKey, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step={row.step}
                        min="0"
                        value={String(form[row.basicKey])}
                        onChange={(e) => setField(row.basicKey, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <div className="text-sm text-muted-foreground">
              {activeRange
                ? <>Сумма полной выплаты: <span className="font-medium text-foreground">{activeRange.split(" — ")[1]}</span> · базовой: <span className="font-medium text-foreground">{activeRange.split(" — ")[0]}</span> (активная программа)</>
                : "Нет активной программы — суммы пока не заданы"}
              {savedCenter === selectedCenterId && <span className="ml-3 text-green-700">· сохранены</span>}
            </div>
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Сохранение…" : "Утвердить критерии"}
            </Button>
          </div>
        </Card>

        <CoachTiersCard centerId={selectedCenterId} />
        </>
      )}
    </div>
  );
}

function AdminProgramsPage() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.roles.includes("superadmin") ?? false;
  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const isDirector = currentUser?.roles.includes("director") ?? false;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState({
    name: "", regulation_number: "", regulation_date: "", revision: "1",
    min_payout: "25000", max_payout: "50000", ndfl_rate: "13", insurance_rate: "30.2",
    is_discretionary: true, status: "draft",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Program[]>("/incentive/programs");
      setPrograms(data);
    } catch (err) {
      setMsg(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrograms(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "", regulation_number: "", regulation_date: "", revision: "1",
      min_payout: "25000", max_payout: "50000", ndfl_rate: "13", insurance_rate: "30.2",
      is_discretionary: true, status: "draft",
    });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (p: Program) => {
    setEditing(p);
    setForm({
      name: p.name, regulation_number: p.regulation_number,
      regulation_date: p.regulation_date, revision: String(p.revision),
      min_payout: String(p.min_payout), max_payout: String(p.max_payout),
      ndfl_rate: String(p.ndfl_rate), insurance_rate: String(p.insurance_rate),
      is_discretionary: p.is_discretionary, status: p.status,
    });
    setFormError("");
    setModalOpen(true);
  };

  const num = (v: string): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const save = async () => {
    setFormError("");
    if (!form.name || !form.regulation_number) {
      setFormError("Укажите название и номер положения");
      return;
    }
    const min = num(form.min_payout);
    const max = num(form.max_payout);
    const ndfl = num(form.ndfl_rate);
    const ins = num(form.insurance_rate);
    if (min === null || max === null || ndfl === null || ins === null) {
      setFormError("Проверьте числовые значения");
      return;
    }
    if (min > max) {
      setFormError("Минимальная выплата не может быть больше максимальной");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        regulation_number: form.regulation_number,
        regulation_date: form.regulation_date,
        revision: num(form.revision),
        min_payout: min,
        max_payout: max,
        ndfl_rate: ndfl,
        insurance_rate: ins,
        is_discretionary: form.is_discretionary,
        status: form.status,
      };
      if (editing) {
        await apiFetch(`/incentive/programs/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/incentive/programs", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      fetchPrograms();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (p: Program, status: string) => {
    try {
      await apiFetch(`/incentive/programs/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      fetchPrograms();
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  };

  const canAccess = isSuperadmin || isAdmin || isDirector;

  if (!canAccess) {
    return (
      <AppShell title="Программы" subtitle="Программы стимулирования">
        <div className="p-8 text-center text-muted-foreground">Доступ запрещён</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Программы" subtitle="Материальное стимулирование">
      <div className="flex flex-col gap-6 p-6">
        <Tabs defaultValue={isSuperadmin ? "programs" : "criteria"}>
          <TabsList>
            <TabsTrigger value="programs">Положения</TabsTrigger>
            <TabsTrigger value="criteria">Критерии</TabsTrigger>
          </TabsList>

          <TabsContent value="programs">
            <ProgramsTable
              programs={programs}
              loading={loading}
              canManage={isSuperadmin}
              onCreate={openCreate}
              onEdit={openEdit}
              onQuickStatus={quickStatus}
              error={msg}
            />
          </TabsContent>

          <TabsContent value="criteria">
            <CriteriaTab />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать программу" : "Новая программа"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{formError}</div>
            )}
            <div className="space-y-1.5">
              <Label>Название *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Положение о мат. поддержке" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Номер приказа *</Label>
                <Input value={form.regulation_number} onChange={(e) => setForm({ ...form, regulation_number: e.target.value })} placeholder="ЦСиЗ-26-П022" />
              </div>
              <div className="space-y-1.5">
                <Label>Дата</Label>
                <Input type="date" value={form.regulation_date} onChange={(e) => setForm({ ...form, regulation_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Ред.</Label>
                <Input value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Мин. выплата, ₽</Label>
                <Input type="number" value={form.min_payout} onChange={(e) => setForm({ ...form, min_payout: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Макс. выплата, ₽</Label>
                <Input type="number" value={form.max_payout} onChange={(e) => setForm({ ...form, max_payout: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>НДФЛ, %</Label>
                <Input type="number" step="0.1" value={form.ndfl_rate} onChange={(e) => setForm({ ...form, ndfl_rate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Страховые взносы, %</Label>
                <Input type="number" step="0.1" value={form.insurance_rate} onChange={(e) => setForm({ ...form, insurance_rate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Статус</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="active">Активна</SelectItem>
                    <SelectItem value="archived">Архив</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
                <Switch checked={form.is_discretionary} onCheckedChange={(v) => setForm({ ...form, is_discretionary: v })} />
                <span>Факультативная</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Сохранение…" : editing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}