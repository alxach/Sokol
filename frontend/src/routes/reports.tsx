import { useState, useCallback, useEffect } from "react";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { format } from "date-fns";
import { FileText, FileDown, Plus, Search, CheckCircle, XCircle, Send, Eye, X, Trash2, AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ReportDto, type ReportStatus,
  fetchReports, fetchReport, submitReport, approveReport, rejectReport, deleteReport, redraftReport,
  fetchReportTemplates, type ReportTemplateDto, type ReportFieldDto,
} from "@/lib/api/reports.functions";
import { generateReportDocx } from "@/lib/api/reports.functions";
import { fetchGroups, type GroupDto } from "@/lib/api/groups.functions";
/**
 * Server-authoritative payout calculation per Положение ред. 8, Приложение №6.
 * Matches backend app/services/incentive_calc.py functions:
 *   - base = net / (1 - NDFL_rate)
 *   - gross = base * (1 + insurance_rate)
 *   - ndfl = base * NDFL_rate
 *   - insurance = base * insurance_rate
 * All results rounded to kopecks (2 decimals).
 */
function calcPayoutBreakdown(net: number): {
  gross: number;
  ndfl: number;
  insurance: number;
} {
  const base = net / 0.87;               // net / (1 - 13%)
  const gross = base * 1.302;            // base * (1 + 30.2%)
  const ndfl = base * 0.13;              // base * 13%
  const insurance = base * 0.302;        // base * 30.2%
  return {
    gross: Number(gross.toFixed(2)),
    ndfl: Number(ndfl.toFixed(2)),
    insurance: Number(insurance.toFixed(2)),
  };
}

function downloadBase64(base64: string, filename: string) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const byteArr = new Uint8Array(byteNums);
  const blob = new Blob([byteArr], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function initialsOf(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function toRuDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, "dd.MM.yyyy");
}

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Отчёты — СОКОЛ" },
      { name: "description", content: "Отчётность тренеров: создание, отправка, утверждение." },
    ],
  }),
  component: ReportsPage,
});

const statusConfig: Record<ReportStatus, { label: string; style: string }> = {
  draft: { label: "Черновик", style: "bg-muted text-muted-foreground border-border" },
  submitted: { label: "На проверке", style: "bg-accent/15 text-accent-foreground border-accent/30" },
  approved: { label: "Утверждён", style: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" },
  rejected: { label: "Отклонён", style: "bg-destructive/10 text-destructive border-destructive/30" },
};

const statusFilters: ("Все" | ReportStatus)[] = ["Все", "draft", "submitted", "approved", "rejected"];

function ReportsPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach, isDirector, isSuperadmin } = useAuth();
  const canReview = isAdmin || isDirector || isSuperadmin;
  const router = useRouterState();
  const isChildRoute = router.matches.some((m) => m.routeId.startsWith("/reports/") && m.routeId !== "/reports");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [templateById, setTemplateById] = useState<Record<string, ReportTemplateDto>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setError(null);
      const [data, templates] = await Promise.all([
        fetchReports(isAdmin || isDirector ? { centerId: user?.centerId } : {}),
        fetchReportTemplates(),
      ]);
      setReports(data.items);
      const map: Record<string, ReportTemplateDto> = {};
      for (const t of templates) map[t.id] = t;
      setTemplateById(map);
    } catch (err) {
      console.error("Ошибка загрузки отчётов:", err);
      setError("Не удалось загрузить отчёты.");
    }
  }, [isAdmin, user?.centerId]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const handleDownload = async (r: ReportDto, groups: GroupDto[]) => {
    setDownloading(r.id);
    try {
      const coachGroups = groups.filter((g) => r.coach_user_id ? g.coach_user_id === r.coach_user_id : g.coach_id === r.coach_id);
      const resolvedGroup = coachGroups.map((g) => g.name).join(", ");
      const result = await generateReportDocx({
        data: {
          reportId: r.id,
          coachName: r.coach_name ?? r.author_name ?? "—",
          sport: r.sport ?? "—",
          group: resolvedGroup,
          periodStart: toRuDate(r.period_start),
          periodEnd: toRuDate(r.period_end),
          status: r.status,
          submittedAt: toRuDate(r.reviewed_at) || undefined,
          reviewedAt: toRuDate(r.reviewed_at) || undefined,
          reviewerName: undefined,
          reviewerComment: r.review_comment ?? undefined,
          data: r.data_json as Record<string, string | number>,
        },
      });
      downloadBase64(result.base64, result.filename);
    } catch (err) {
      console.error("Ошибка при создании Word-документа:", err);
      alert("Не удалось создать документ. Попробуйте ещё раз.");
    } finally {
      setDownloading(null);
    }
  };

  const accessible = reports;
  const filtered = accessible.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q ||
      (r.coach_name ?? "").toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.sport ?? "").toLowerCase().includes(q);
    const matchS = statusFilter === "Все" || r.status === statusFilter;
    return matchQ && matchS;
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <AppShell title="Отчёты" subtitle="Отчётность и утверждение">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">Отчёты тренеров</h2>
          <p className="text-sm text-muted-foreground">
            {accessible.filter((r) => r.status === "submitted").length} ожидают проверки · {accessible.filter((r) => r.status === "approved").length} утверждено
          </p>
        </div>
        {isCoach && (
          <Link to="/reports/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Создать отчёт
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по тренеру, ID…"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map((s) => {
              const cfg = s === "Все" ? { label: "Все", style: "" } : statusConfig[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    statusFilter === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="border-b border-border px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Тренер</th>
                <th className="px-4 py-3 font-medium">Период</th>
                <th className="px-4 py-3 font-medium">Вид спорта</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="transition hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-[10px] font-bold text-primary-foreground">
                        {initialsOf(r.coach_name ?? r.author_name)}
                      </div>
                      <span className="font-medium text-secondary">{r.coach_name ?? r.author_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{toRuDate(r.period_start)} – {toRuDate(r.period_end)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.sport ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`font-normal ${statusConfig[r.status].style}`}>
                      {statusConfig[r.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedId(r.id)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Открыть
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={async () => {
                          try {
                            const groups = await (await fetchGroups({ perPage: 1000 })).items;
                            await handleDownload(r, groups);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        disabled={downloading === r.id}
                      >
                        <FileDown className="mr-1 h-3.5 w-3.5" /> {downloading === r.id ? "..." : "Word"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {reports.length === 0 ? "Отчёты не найдены." : "Ничего не найдено по выбранным фильтрам."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <button onClick={() => { setSelectedId(null); loadReports(); }} className="hover:text-foreground">Обновить</button>
        </div>
      </Card>

      {selectedId && (
        <ReportDetailModal
          reportId={selectedId}
          templateById={templateById}
          canReview={canReview}
          isAuthor={isCoach && user ? (reports.find((r) => r.id === selectedId)?.author_id === user.id) : false}
          onClose={() => setSelectedId(null)}
          onReload={loadReports}
        />
      )}
    </AppShell>
  );
}

function ReportDetailModal({
  reportId, templateById, canReview, isAuthor, onClose, onReload,
}: {
  reportId: string;
  templateById: Record<string, ReportTemplateDto>;
  canReview: boolean;
  isAuthor: boolean;
  onClose: () => void;
  onReload: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalDownloading, setModalDownloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const r = await fetchReport(reportId);
      setReport(r);
    } catch (err) {
      console.error("Ошибка загрузки отчёта:", err);
      setError("Не удалось загрузить отчёт.");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { void load(); }, [load]);

  if (!report) {
    if (loading) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-destructive">{error ?? "Отчёт не найден."}</p>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>Закрыть</Button>
          </div>
        </div>
      </div>
    );
  }

  const template = report.template_id ? templateById[report.template_id] : undefined;
  const fields: ReportFieldDto[] = template?.structure_json?.fields ?? [];

  const handleModalDownload = async () => {
    setModalDownloading(true);
    try {
      const { items } = await fetchGroups({ perPage: 1000 });
      const coachGroups = items.filter((g) =>
        report.coach_user_id ? g.coach_user_id === report.coach_user_id : g.coach_id === report.coach_id,
      );
      const resolvedGroup = coachGroups.map((g) => g.name).join(", ");
      const result = await generateReportDocx({
        data: {
          reportId: report.id,
          coachName: report.coach_name ?? report.author_name ?? "—",
          sport: report.sport ?? "—",
          group: resolvedGroup,
          periodStart: toRuDate(report.period_start),
          periodEnd: toRuDate(report.period_end),
          status: report.status,
          submittedAt: undefined,
          reviewedAt: toRuDate(report.reviewed_at) || undefined,
          reviewerName: undefined,
          reviewerComment: report.review_comment ?? undefined,
          data: report.data_json as Record<string, string | number>,
        },
      });
      downloadBase64(result.base64, result.filename);
    } catch (err) {
      console.error("Ошибка при создании Word-документа:", err);
      alert("Не удалось создать документ.");
    } finally {
      setModalDownloading(false);
    }
  };

  const runAction = async (action: () => Promise<ReportDto>) => {
    setBusy(true);
    try {
      await action();
      await load();
      onReload();
    } catch (err) {
      console.error(err);
      alert("Операция не выполнена. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = () => runAction(() => approveReport(report.id));
  const handleReject = () => {
    if (!rejectComment.trim()) return;
    runAction(() => rejectReport(report.id, rejectComment));
  };
  const handleSubmitDraft = () => runAction(() => submitReport(report.id));
  const handleRedraft = () => runAction(() => redraftReport(report.id));
  const handleDelete = async () => {
    if (!window.confirm("Удалить черновик отчёта?")) return;
    setBusy(true);
    try {
      await deleteReport(report.id);
      onReload();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить отчёт.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">{template?.name ?? report.template_name ?? "Отчёт"}</h3>
            <p className="text-sm text-muted-foreground">
              {report.coach_name ?? report.author_name} · {report.sport ?? "—"} · {report.center_name ?? ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-8" onClick={handleModalDownload} disabled={modalDownloading}>
              <FileDown className="mr-1 h-3.5 w-3.5" /> {modalDownloading ? "..." : "Скачать Word"}
            </Button>
            <Badge variant="outline" className={`font-normal ${statusConfig[report.status].style}`}>
              {statusConfig[report.status].label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Period */}
        <div className="border-b border-border px-6 py-3 text-sm text-muted-foreground">
          Отчётный период: <span className="font-medium text-foreground">{toRuDate(report.period_start)}</span> – <span className="font-medium text-foreground">{toRuDate(report.period_end)}</span>
          {report.reviewed_at && <> · Проверен: <span className="font-medium text-foreground">{toRuDate(report.reviewed_at)}</span></>}
        </div>

        {/* Protocol link */}
        {report.commission_protocol_id && (
          <div className="border-b border-border px-6 py-2 flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-primary/60" />
            <span>Привязан к протоколу комиссии: <span className="font-medium text-foreground">{report.commission_protocol_id.slice(0, 8)}</span></span>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4 px-6 py-4">
          {fields.map((field) => {
            const value = report.data_json[field.key];
            const numVal = typeof value === "number" ? value : Number(value);
            const meetsNormFull = field.normFull != null && !isNaN(numVal) ? numVal >= field.normFull : null;
            const meetsNormBasic = field.normBasic != null && !isNaN(numVal) ? numVal >= field.normBasic : null;
            const confirmationLabel = field.confirmationForm === "mandatory_in_report"
              ? "Подтверждается формой отчёта"
              : field.confirmationForm === "on_request"
                ? "По запросу Благополучателя"
                : "";

            return (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {field.label}
                  {field.confirmationForm && (
                    <span className={`ml-2 text-xs ${
                      field.confirmationForm === "mandatory_in_report"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}>
                      ({confirmationLabel})
                    </span>
                  )}
                </label>
                {field.type === "number" ? (
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-display font-bold text-secondary">{String(value ?? "—")}</div>
                    {meetsNormFull !== null && (
                      <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        meetsNormFull
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : meetsNormBasic
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {meetsNormFull ? "≥50К" : meetsNormBasic ? "≥25К" : "ниже нормы"}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground whitespace-pre-wrap">
                    {(value as string) || "—"}
                  </div>
                )}
                {field.normFull != null && (
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Норма: <span className="font-medium text-foreground">≥{field.normFull}</span> (50К)
                      {" / "}
                      <span className="font-medium text-foreground">≥{field.normBasic}</span> (25К)
                    </span>
                    {field.unit && <span className="text-muted-foreground/60">({field.unit})</span>}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">Оценка комиссии:</span>
                  <span className="text-muted-foreground/60">Выполнено / не выполнено</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground/60">ФИО руководителя, подпись</span>
                </div>
              </div>
            );
          })}
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">Нет данных для отображения.</p>
          )}
        </div>

        {/* Reviewer comment */}
        {report.review_comment && (
          <div className="mx-6 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <XCircle className="h-3.5 w-3.5" /> Комментарий проверяющего
            </div>
            <p className="mt-1 text-sm text-foreground">{report.review_comment}</p>
          </div>
        )}

        {/* Payout calculation (v8, Приложение №6) */}
        {report.payout_tier != null && report.payout_tier > 0 && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-secondary">Расчёт выплаты (Приложение №6)</span>
              <Badge variant="outline" className="text-xs font-normal">
                {Number(report.payout_tier).toLocaleString("ru-RU")} ₽
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-4 rounded-lg border border-border bg-muted/20 p-3 text-sm">
{(() => {
        const net = report.payout_tier!;
        const {gross, ndfl, insurance} = calcPayoutBreakdown(net);
        return (
          <>
            <div>
              <span className="text-xs text-muted-foreground">Выплата на карту (нетто)</span>
              <div className="font-display font-bold text-secondary">{net.toLocaleString("ru-RU")} ₽</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">НДФЛ (13%)</span>
              <div className="font-medium text-red-600 dark:text-red-400">−{ndfl.toLocaleString("ru-RU")} ₽</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Страховые взносы (30,2%)</span>
              <div className="font-medium text-amber-600 dark:text-amber-400">{insurance.toLocaleString("ru-RU")} ₽</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Итого брутто (затраты Организации)</span>
              <div className="font-display font-bold text-secondary">{gross.toLocaleString("ru-RU")} ₽</div>
            </div>
          </>
        );
      })()}
            </div>
          </div>
        )}

        {(report.status !== "draft" && (report.payout_tier == null || report.payout_tier <= 0)) && (
          <div className="flex items-start gap-2 border-t border-border px-6 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Выплата не сформирована (0 ₽): тренеру не назначен тир (базовый/полный) или не выполнены нормы отчёта.</span>
          </div>
        )}

        {/* Actions */}
        {canReview && report.status === "submitted" && (
          <div className="border-t border-border px-6 py-4">
            {showRejectInput && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Причина отклонения *</label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                  placeholder="Укажите причину отклонения..."
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              {showRejectInput ? (
                <>
                  <Button variant="outline" onClick={() => { setShowRejectInput(false); setRejectComment(""); }} disabled={busy}>
                    Отмена
                  </Button>
                  <Button
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleReject}
                    disabled={!rejectComment.trim() || busy}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Подтвердить отклонение
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setShowRejectInput(true)}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Отклонить
                  </Button>
                  <Button className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90" onClick={handleApprove} disabled={busy}>
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Утвердить
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {report.status === "rejected" && isAuthor && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={handleRedraft}
              disabled={busy}
            >
              <FileText className="mr-1.5 h-4 w-4" /> Вернуть в черновик
            </Button>
            <span className="text-xs text-muted-foreground">
              Верните отчёт в черновик, внесите исправления и отправьте повторно.
            </span>
          </div>
        )}

        {report.status === "draft" && isAuthor && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => { onClose(); navigate({ to: "/reports/new", search: { reportId: report.id } }); }} disabled={busy}>
              Редактировать
            </Button>
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Удалить
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmitDraft} disabled={busy}>
              <Send className="mr-1.5 h-4 w-4" /> Отправить на проверку
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}