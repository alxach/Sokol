import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search, Medal, Pencil, Trash2, X, FileDown, Upload, Info, Award, CalendarCheck, FileText } from "lucide-react";

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
  athletes,
  groups,
  attendanceRecords,
  type AthleteStatus,
  type Discipline,
  type Athlete,
  type Group,
} from "@/lib/mock-data";
import { exportToExcel, importAthletesFromExcel } from "@/lib/api/exports.functions";
import { AthleteModal, disciplines } from "@/components/athlete-modal";

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
      { name: "description", content: "CRM спортсменов: карточки, дисциплины, рейтинг, медали." },
    ],
  }),
  component: AthletesPage,
});

const statusStyle: Record<AthleteStatus, string> = {
  "Активный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  "Травма": "bg-destructive/10 text-destructive border-destructive/30",
  "Резерв": "bg-muted text-muted-foreground border-border",
};

function AthletesPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach } = useAuth();
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<(typeof disciplines)[number]>("Все");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [detailAthlete, setDetailAthlete] = useState<Athlete | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importData, setImportData] = useState<{
    athletes: { tempId: number; name: string; discipline: string; rank: string; age: number; city: string; coach: string; status: string; gold: number; silver: number; bronze: number; rating: number; lastEvent: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportToExcel({
        data: { type: "athletes", data: filtered.map((a) => ({ ...a, groupId: a.groupId ?? undefined })) },
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

  const confirmImport = () => {
    if (!importData) return;
    const maxId = athletes.reduce((m, a) => {
      const num = parseInt(a.id.replace("SK-", ""), 10);
      return num > m ? num : m;
    }, 0);
    for (const a of importData.athletes) {
      const newId = maxId + 1 + a.tempId;
      athletes.push({
        id: `SK-${String(newId).padStart(4, "0")}`,
        name: a.name,
        discipline: a.discipline as Discipline,
        rank: a.rank || "КМС",
        age: a.age || 0,
        city: a.city || "",
        coach: a.coach || "",
        status: (a.status as AthleteStatus) || "Активный",
        medals: { gold: a.gold, silver: a.silver, bronze: a.bronze },
        rating: a.rating || 0,
        lastEvent: a.lastEvent || "",
      });
    }
    setImportData(null);
    setQuery((q) => q + " ");
    setTimeout(() => setQuery((q) => q.trim()), 0);
  };

  const accessible = useMemo(() => {
    return isCoach && user?.coachName
      ? athletes.filter((a) => a.coach === user.coachName)
      : athletes;
  }, [isCoach, user]);

  const filtered = useMemo(() => {
    return accessible.filter((a) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q);
      const matchD = discipline === "Все" || a.discipline === discipline;
      return matchQ && matchD;
    });
  }, [query, discipline, accessible]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((a) => a.status === "Активный").length;
    const gold = filtered.reduce((s, a) => s + a.medals.gold, 0);
    const avg = total ? Math.round(filtered.reduce((s, a) => s + a.rating, 0) / total) : 0;
    return { total, active, gold, avg };
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
            {totals.total} в выборке · {totals.active} активных · средний рейтинг {totals.avg}
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
          <Button variant="outline" disabled>
            <Filter className="mr-2 h-4 w-4" /> Фильтры
          </Button>
          <Button onClick={() => { setEditing(null); setShowModal(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>

      {/* Mini KPIs */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Всего в выборке" value={totals.total.toString()} accent="primary" />
        <MiniStat label="Активные" value={totals.active.toString()} accent="success" />
        <MiniStat label="Золотых медалей" value={totals.gold.toString()} accent="accent" icon={<Medal className="h-4 w-4" />} />
        <MiniStat label="Средний рейтинг" value={totals.avg.toLocaleString("ru-RU")} accent="secondary" />
      </section>

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
          {!isCoach && (
          <div className="flex flex-wrap gap-1.5">
            {disciplines.map((d) => (
              <button
                key={d}
                onClick={() => setDiscipline(d)}
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
                <TableHead>Группа</TableHead>
                <TableHead className="text-center">Медали (З/С/Б)</TableHead>
                <TableHead className="text-right">Рейтинг</TableHead>
                <TableHead className="w-[80px] text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailAthlete(a)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-secondary">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.city} · {a.age} лет</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary">
                      {a.discipline}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-secondary">{a.rank}</TableCell>
                  {!isCoach && <TableCell className="text-sm text-muted-foreground">{a.coach}</TableCell>}
                  <TableCell>
                    <Badge variant="outline" className={`font-normal ${statusStyle[a.status]}`}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.groupId ? (groups.find((g) => g.id === a.groupId)?.name ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-secondary">{a.medals.gold}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{a.medals.silver}</span>
                      <span className="rounded bg-[oklch(0.65_0.12_50)]/15 px-1.5 py-0.5 text-[oklch(0.5_0.12_50)]">{a.medals.bronze}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-display font-bold text-primary">
                    {a.rating.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setEditing(a); setShowModal(true); }}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Удалить ${a.name}?`)) {
                            for (const g of groups) {
                              const gi = g.athleteIds.indexOf(a.id);
                              if (gi !== -1) g.athleteIds.splice(gi, 1);
                            }
                            const idx = athletes.findIndex((x) => x.id === a.id);
                            if (idx !== -1) athletes.splice(idx, 1);
                            setQuery((q) => q + " ");
                            setTimeout(() => setQuery((q) => q.trim()), 0);
                          }
                        }}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isCoach ? 9 : 10} className="py-12 text-center text-sm text-muted-foreground">
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
          coachName={isCoach ? user?.coachName ?? "" : undefined}
          coachDiscipline={isCoach ? user?.coachDiscipline : undefined}
          coachCity={isCoach ? user?.city : undefined}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => {
            setShowModal(false);
            setEditing(null);
            setQuery((q) => q + " ");
            setTimeout(() => setQuery((q) => q.trim()), 0);
          }}
        />
      )}

      {detailAthlete && (
        <AthleteDetailModal
          athlete={detailAthlete}
          onClose={() => setDetailAthlete(null)}
        />
      )}

      {/* Import confirmation modal */}
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
              <Button onClick={confirmImport} className="bg-primary text-primary-foreground">
                Импортировать {importData.athletes.length} спортсменов
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ---------- Athlete Detail Modal ---------- */

const statusStyleAthlete: Record<AthleteStatus, string> = {
  "Активный": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  "Травма": "bg-destructive/10 text-destructive border-destructive/30",
  "Резерв": "bg-muted text-muted-foreground border-border",
};

const tabList = [
  { id: "info", label: "Информация", icon: Info },
  { id: "achievements", label: "Достижения", icon: Award },
  { id: "attendance", label: "Посещаемость", icon: CalendarCheck },
  { id: "documents", label: "Документы", icon: FileText },
] as const;

type TabId = (typeof tabList)[number]["id"];

function AthleteDetailModal({ athlete, onClose }: { athlete: Athlete; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("info");

  const athleteAttendance = useMemo(
    () => attendanceRecords.filter((r) => r.athleteId === athlete.id),
    [athlete.id],
  );
  const attendancePct = useMemo(() => {
    if (athleteAttendance.length === 0) return 0;
    const present = athleteAttendance.filter((r) => r.status === "present").length;
    return Math.round((present / athleteAttendance.length) * 100);
  }, [athleteAttendance]);

  const initials = athlete.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-secondary">{athlete.name}</h3>
              <p className="text-xs text-muted-foreground">{athlete.id} · {athlete.city}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border px-6">
          {tabList.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "info" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <span className="text-xs text-muted-foreground">Дисциплина</span>
                  <div className="mt-0.5 font-medium text-secondary">{athlete.discipline}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Разряд</span>
                  <div className="mt-0.5 font-medium text-secondary">{athlete.rank}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Возраст</span>
                  <div className="mt-0.5 font-medium text-secondary">{athlete.age} лет</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Город</span>
                  <div className="mt-0.5 font-medium text-secondary">{athlete.city}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Тренер</span>
                  <div className="mt-0.5 font-medium text-secondary">{athlete.coach}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Статус</span>
                  <div className="mt-1">
                    <Badge variant="outline" className={`font-normal ${statusStyleAthlete[athlete.status]}`}>
                      {athlete.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Последнее мероприятие</span>
                <div className="mt-0.5 font-medium text-secondary">{athlete.lastEvent || "—"}</div>
              </div>
            </div>
          )}

          {tab === "achievements" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-accent/10 p-4 text-center">
                  <div className="text-2xl font-bold text-secondary">{athlete.medals.gold}</div>
                  <div className="text-xs text-muted-foreground">Золото</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-4 text-center">
                  <div className="text-2xl font-bold text-secondary">{athlete.medals.silver}</div>
                  <div className="text-xs text-muted-foreground">Серебро</div>
                </div>
                <div className="rounded-lg bg-[oklch(0.65_0.12_50)]/10 p-4 text-center">
                  <div className="text-2xl font-bold text-secondary">{athlete.medals.bronze}</div>
                  <div className="text-xs text-muted-foreground">Бронза</div>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Рейтинг</span>
                <div className="mt-0.5 font-display text-2xl font-bold text-primary">
                  {athlete.rating.toLocaleString("ru-RU")}
                </div>
              </div>
            </div>
          )}

          {tab === "attendance" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-4">
                <div className="text-2xl font-bold text-primary">{attendancePct}%</div>
                <div className="text-xs text-muted-foreground">
                  {athleteAttendance.filter((r) => r.status === "present").length} из {athleteAttendance.length} занятий
                </div>
              </div>
              {athleteAttendance.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Нет записей посещаемости</p>
              ) : (
                <div className="space-y-2">
                  {athleteAttendance.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm">
                      <span className="text-muted-foreground">{r.date}</span>
                      <Badge
                        variant="outline"
                        className={`font-normal ${
                          r.status === "present"
                            ? "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
                            : r.status === "excused"
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                        }`}
                      >
                        {r.status === "present" ? "Присутствовал" : r.status === "excused" ? "Уваж. причина" : "Отсутствовал"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p>Раздел в разработке</p>
              <p className="text-xs">Медсправки, согласия, страховки</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: "primary" | "secondary" | "accent" | "success";
  icon?: React.ReactNode;
}) {
  const tone: Record<typeof accent, string> = {
    primary: "border-l-primary",
    secondary: "border-l-secondary",
    accent: "border-l-accent",
    success: "border-l-[color:var(--success)]",
  };
  return (
    <Card className={`flex items-center justify-between border-l-4 p-5 shadow-[var(--shadow-card)] ${tone[accent]}`}>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-2xl font-bold text-secondary">{value}</div>
      </div>
      {icon && <div className="text-accent">{icon}</div>}
    </Card>
  );
}
