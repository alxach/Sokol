import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search, Pencil, Trash2, X, FileDown, Upload, Info } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuthGuard, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  athleteFullName,
  athleteStatusLabels,
  calcAge,
  createAthlete,
  deleteAthlete,
  fetchAthletes,
  transferAthlete,
  updateAthlete,
  type AthleteDto,
  type AthleteStatusKey,
} from "@/lib/api/athletes.functions";
import { fetchCoaches, findCoachByUserId, type CoachDto } from "@/lib/api/coaches.functions";
import { exportToExcel, importAthletesFromExcel } from "@/lib/api/exports.functions";
import { MiniStat } from "@/components/mini-stat";
import { AthleteModal, disciplines } from "@/components/athlete-modal";
import { isSportRank } from "@/lib/ranks";

function downloadBase64(base64: string, filename: string) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const byteArr = new Uint8Array(byteNums);
  const blob = new Blob([byteArr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/athletes")({
  head: () => ({
    meta: [
      { title: "Спортсмены — СОКОЛ" },
      { name: "description", content: "CRM спортсменов: карточки, дисциплины." },
    ],
  }),
  component: AthletesPage,
});

const statusStyle: Record<AthleteStatusKey, string> = {
  active: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  inactive: "bg-primary/10 text-primary border-primary/30",
};

interface ImportedAthlete {
  tempId: number;
  name: string;
  discipline: string;
  rank: string;
  age: number;
  city: string;
  coach: string;
  status: string;
}

function splitFullName(name: string): { last: string; first: string; middle: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { last: "", first: "", middle: "" };
  if (parts.length === 1) return { last: "", first: parts[0], middle: "" };
  if (parts.length === 2) return { last: parts[0], first: parts[1], middle: "" };
  return { last: parts[0], first: parts[1], middle: parts.slice(2).join(" ") };
}

function AthletesPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach } = useAuth();
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<(typeof disciplines)[number]>("Все");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AthleteDto | null>(null);
  const [detailAthlete, setDetailAthlete] = useState<AthleteDto | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importData, setImportData] = useState<{ athletes: ImportedAthlete[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<AthleteDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [myCoachId, setMyCoachId] = useState<string | null>(null);

  const loadList = useCallback(async (coachId: string | null, isCoachMode: boolean) => {
    setItemsLoading(true);
    setItemsError("");
    try {
      const res = await fetchAthletes({ coachId: isCoachMode ? coachId : null });
      setItems(res.items);
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : "Не удалось загрузить спортсменов");
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (isCoach && user?.id) {
        let coachId: string | null = null;
        try {
          const c = await findCoachByUserId(user.id);
          coachId = c?.id ?? null;
        } catch {
          coachId = null;
        }
        if (cancelled) return;
        setMyCoachId(coachId);
        await loadList(coachId, true);
      } else {
        await loadList(null, false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isCoach, user, loadList]);

  const handleDelete = async (a: AthleteDto) => {
    if (!confirm(`Удалить ${athleteFullName(a)}?`)) return;
    try {
      await deleteAthlete(a.id);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить спортсмена");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportToExcel({
        data: {
          type: "athletes",
          data: filtered.map((a) => ({
            id: a.id,
            name: athleteFullName(a),
            discipline: a.sport_type,
            rank: a.rank ?? "",
            age: calcAge(a.birth_date),
            city: a.center_city ?? a.center_name ?? "",
            coach: a.coach_name ?? "",
            status: athleteStatusLabels[(a.status as AthleteStatusKey)] ?? a.status,
          })),
        },
      });
      downloadBase64(result.base64, result.filename);
    } catch (err) {
      console.error(err);
      alert("Не удалось создать Excel-файл.");
    } finally {
      setExporting(false);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const result = await importAthletesFromExcel({ data: { base64 } });
      setImportData(result);
    } catch (err) {
      console.error(err);
      alert("Ошибка при импорте: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const confirmImport = async () => {
    if (!importData) return;
    setImporting(true);
    try {
      for (const a of importData.athletes) {
        const { last, first, middle } = splitFullName(a.name);
        if (!last || !first) continue;
        const birthYear = a.age > 0 ? new Date().getFullYear() - a.age : 2000;
        await createAthlete({
          first_name: first,
          last_name: last,
          middle_name: middle || undefined,
          birth_date: `${birthYear}-01-01`,
          gender: "male",
          sport_type: a.discipline || "Дзюдо",
          coach_id: isCoach ? myCoachId ?? undefined : undefined,
        });
      }
      setImportData(null);
      await loadList(myCoachId, isCoach);
    } catch (err) {
      console.error(err);
      alert("Не удалось импортировать спортсменов: " + (err instanceof Error ? err.message : "ошибка"));
    } finally {
      setImporting(false);
    }
  };

  const disciplineOptions = useMemo(() => {
    return ["Все", ...new Set(items.map((a) => a.sport_type))];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      const q = query.trim().toLowerCase();
      const haystack = [athleteFullName(a), a.id, a.center_city ?? "", a.center_name ?? "", a.coach_name ?? ""]
        .join(" ")
        .toLowerCase();
      const matchQ = !q || haystack.includes(q);
      const matchD = discipline === "Все" || a.sport_type === discipline;
      return matchQ && matchD;
    });
  }, [query, discipline, items]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((a) => a.status === "active").length;
    const ages = filtered.map((a) => calcAge(a.birth_date)).filter((n) => n > 0);
    const avgAge = ages.length ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length) : 0;
    const ranked = filtered.filter((a) => isSportRank(a.rank)).length;
    return { total, active, avgAge, ranked };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Спортсмены" subtitle={isCoach ? "Мои спортсмены" : "CRM сборной команды"}>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">
            {isCoach ? "Мои спортсмены" : "Реестр спортсменов"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {totals.total} в выборке · {totals.active} активных · средний возраст {totals.avgAge}
          </p>
        </div>
        <div className="flex gap-2">
          {!isCoach && (
          <>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium shadow-xs transition hover:bg-accent/10 ${importing ? "opacity-60" : ""}`}>
            <Upload className="h-4 w-4" />
            {importing ? "Импорт..." : "Импорт"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFilePick} disabled={importing} />
          </label>
          </>
          )}
          {!isCoach && (
            <Button variant="outline" disabled>
              <Filter className="mr-2 h-4 w-4" /> Фильтры
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setShowModal(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Всего в выборке" value={totals.total.toString()} accent="primary" />
        <MiniStat label="Активные" value={totals.active.toString()} accent="success" />
        <MiniStat label="Средний возраст" value={`${totals.avgAge} лет`} accent="accent" />
        <MiniStat label="С разрядом" value={totals.ranked.toString()} accent="secondary" />
      </section>

      {itemsError && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Ошибка загрузки: {itemsError}
        </div>
      )}

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Фамилия"
              className="h-9 pl-9"
            />
          </div>
          {!isCoach && disciplineOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {disciplineOptions.map((d) => (
                <button
                  key={d}
                  onClick={() => setDiscipline(d as (typeof disciplines)[number])}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    discipline === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[110px]">ID</TableHead>
                <TableHead>Спортсмен</TableHead>
                <TableHead>Дисциплина</TableHead>
                <TableHead>Разряд</TableHead>
                {!isCoach && <TableHead>Тренер</TableHead>}
                <TableHead>Статус</TableHead>
                <TableHead className="w-[80px] text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow>
                  <TableCell colSpan={isCoach ? 6 : 7} className="py-12 text-center text-sm text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : filtered.map((a) => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailAthlete(a)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
                        {athleteFullName(a).split(" ").map((n) => n[0]).filter(Boolean).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-secondary">{athleteFullName(a)}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.center_city || a.center_name || "Город не указан"} · {calcAge(a.birth_date)} лет
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                      {a.sport_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-secondary">{a.rank || "—"}</TableCell>
                  {!isCoach && <TableCell className="text-sm text-muted-foreground">{a.coach_name || "—"}</TableCell>}
                  <TableCell>
                    <Badge variant="outline" className={`font-normal ${statusStyle[(a.status as AthleteStatusKey) ?? "active"]}`}>
                      {athleteStatusLabels[(a.status as AthleteStatusKey)] ?? a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(a); setShowModal(true); }}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a); }}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!itemsLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isCoach ? 6 : 7} className="py-12 text-center text-sm text-muted-foreground">
                    Ничего не найдено по выбранным фильтрам.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {showModal && (
        <AthleteModal
          athlete={editing}
          coachId={isCoach ? myCoachId ?? undefined : undefined}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => {
            setShowModal(false);
            setEditing(null);
            loadList(myCoachId, isCoach);
          }}
        />
      )}

      {detailAthlete && (
        <AthleteDetailModal
          athlete={detailAthlete}
          onClose={() => setDetailAthlete(null)}
          onChanged={(updated) => {
            setDetailAthlete((prev) => (prev && prev.id === updated.id ? updated : prev));
            loadList(myCoachId, isCoach);
          }}
        />
      )}

      {importData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setImportData(null)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-display text-base font-bold text-secondary">Подтверждение импорта</h3>
              <Button variant="ghost" size="sm" onClick={() => setImportData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 rounded-lg bg-primary/10 p-4 text-sm">
                Найдено <strong>{importData.athletes.length}</strong> спортсменов
              </div>
              <ul className="divide-y divide-border text-sm">
                {importData.athletes.slice(0, 50).map((a) => (
                  <li key={a.tempId} className="flex items-center justify-between py-2">
                    <span className="font-medium text-secondary">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.discipline} · {a.city}</span>
                  </li>
                ))}
                {importData.athletes.length > 50 && (
                  <li className="py-2 text-center text-xs text-muted-foreground">
                    + ещё {importData.athletes.length - 50}
                  </li>
                )}
              </ul>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setImportData(null)}>Отмена</Button>
              <Button onClick={confirmImport} className="bg-primary text-primary-foreground" disabled={importing}>
                {importing ? "Импортируем..." : `Импортировать ${importData.athletes.length} спортсменов`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ---------- Athlete Detail Modal ---------- */

function AthleteDetailModal({
  athlete,
  onClose,
  onChanged,
}: {
  athlete: AthleteDto;
  onClose: () => void;
  onChanged: (updated: AthleteDto) => void;
}) {
  const status = (athlete.status as AthleteStatusKey) ?? "active";
  const isArchived = status === "inactive";

  const [transferOpen, setTransferOpen] = useState(false);
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [targetCoachId, setTargetCoachId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openTransfer = async () => {
    setError("");
    setTransferOpen(true);
    try {
      const list = await fetchCoaches();
      setCoaches(list);
    } catch {
      setCoaches([]);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await updateAthlete(athlete.id, { status: "active" });
      onChanged(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось восстановить спортсмена");
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!targetCoachId) {
      setError("Выберите тренера");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await transferAthlete(athlete.id, targetCoachId);
      onChanged(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось передать спортсмена");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
              {athleteFullName(athlete).split(" ").map((n) => n[0]).filter(Boolean).join("").slice(0, 2)}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-secondary">{athleteFullName(athlete)}</h3>
              <p className="text-xs text-muted-foreground">{athlete.id.slice(0, 8)} · {athlete.center_city || athlete.center_name || "Город не указан"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span className="text-xs text-muted-foreground">Дисциплина</span>
              <div className="mt-0.5 font-medium text-secondary">{athlete.sport_type}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Разряд</span>
              <div className="mt-0.5 font-medium text-secondary">{athlete.rank || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Возраст</span>
              <div className="mt-0.5 font-medium text-secondary">{calcAge(athlete.birth_date)} лет</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Пол</span>
              <div className="mt-0.5 font-medium text-secondary">
                {athlete.gender === "female" ? "Женский" : "Мужской"}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Дата рождения</span>
              <div className="mt-0.5 font-medium text-secondary">
                {new Date(athlete.birth_date).toLocaleDateString("ru-RU")}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Центр</span>
              <div className="mt-0.5 font-medium text-secondary">{athlete.center_name || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Тренер</span>
              <div className="mt-0.5 font-medium text-secondary">{athlete.coach_name || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Статус</span>
              <div className="mt-1">
                <Badge variant="outline" className={`font-normal ${statusStyle[status]}`}>
                  {athleteStatusLabels[status]}
                </Badge>
              </div>
            </div>
          </div>
          {athlete.notes && (
            <div className="mt-5 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">Примечание</span>
              <div className="mt-0.5 font-medium text-secondary">{athlete.notes}</div>
            </div>
          )}

          {isArchived && (
            <div className="mt-5 rounded-lg border border-border p-4">
              <p className="mb-3 text-sm font-medium text-secondary">Архивированный спортсмен</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Данные и история соревнований сохранены. Спортсмена можно восстановить или передать другому тренеру.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={openTransfer} disabled={busy}>
                  Передать другому тренеру
                </Button>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleRestore} disabled={busy}>
                  Восстановить
                </Button>
              </div>
            </div>
          )}

          {transferOpen && (
            <div className="mt-3 rounded-lg border border-border p-4">
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Выберите нового тренера</label>
              <select
                value={targetCoachId}
                onChange={(e) => setTargetCoachId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— выберите тренера —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}{c.center_city ? ` · ${c.center_city}` : ""}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleTransfer} disabled={busy}>
                  {busy ? "Передаём..." : "Передать"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTransferOpen(false)} disabled={busy}>
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          <div className="mt-5 flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4" />
            Разделы «Достижения», «Посещаемость» и «Документы» появятся после перевода соответствующих модулей.
          </div>
        </div>
      </div>
    </div>
  );
}