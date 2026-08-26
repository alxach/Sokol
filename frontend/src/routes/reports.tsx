import { useState } from "react";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { format } from "date-fns";
import { FileText, FileDown, Plus, Search, CheckCircle, XCircle, Send, Eye, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reports, monthlyReportTemplate, groups, type Report, type ReportStatus, persistReports } from "@/lib/mock-data";
import { generateReportDocx } from "@/lib/api/reports.functions";
import { calculateGross, calculateNdf, calculateInsurance } from "@/lib/mock-data";

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
  const { isAdmin, isCoach } = useAuth();
  const router = useRouterState();
  const isChildRoute = router.matches.some((m) => m.routeId.startsWith("/reports/") && m.routeId !== "/reports");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (r: Report) => {
    setDownloading(r.id);
    try {
      const coachGroups = groups.filter((g) => g.coachId === r.coachId);
      const resolvedGroup = coachGroups.map((g) => g.name).join(", ");
      const result = await generateReportDocx({
        data: {
          reportId: r.id,
          coachName: r.coachName,
          sport: r.sport,
          group: resolvedGroup,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          status: r.status,
          submittedAt: r.submittedAt,
          reviewedAt: r.reviewedAt,
          reviewerName: r.reviewerName,
          reviewerComment: r.reviewerComment,
          data: r.data as Record<string, string | number>,
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

  const accessible = reports.filter((r) => {
    if (isCoach && user) return r.coachId === user.id;
    if (isAdmin && user?.centerId) return r.centerId === user.centerId;
    return true;
  });

  const filtered = accessible.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || r.coachName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.sport.toLowerCase().includes(q);
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
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-[10px] font-bold text-primary-foreground">
                        {r.coachInitials}
                      </div>
                      <span className="font-medium text-secondary">{r.coachName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.periodStart} – {r.periodEnd}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.sport}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`font-normal ${statusConfig[r.status].style}`}>
                      {statusConfig[r.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedReport(r)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Открыть
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(r)} disabled={downloading === r.id}>
                        <FileDown className="mr-1 h-3.5 w-3.5" /> {downloading === r.id ? "..." : "Word"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    Ничего не найдено по выбранным фильтрам.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          isAdmin={isAdmin}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </AppShell>
  );
}

function ReportDetailModal({ report, isAdmin, onClose }: { report: Report; isAdmin: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const template = report.templateId === "TPL-001" ? monthlyReportTemplate : undefined;
  const [modalDownloading, setModalDownloading] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleModalDownload = async () => {
    setModalDownloading(true);
    try {
      const coachGroups = groups.filter((g) => g.coachId === report.coachId);
      const resolvedGroup = coachGroups.map((g) => g.name).join(", ");
      const result = await generateReportDocx({
        data: {
          reportId: report.id,
          coachName: report.coachName,
          sport: report.sport,
          group: resolvedGroup,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          status: report.status,
          submittedAt: report.submittedAt,
          reviewedAt: report.reviewedAt,
          reviewerName: report.reviewerName,
          reviewerComment: report.reviewerComment,
          data: report.data as Record<string, string | number>,
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

  const handleApprove = () => {
    report.status = "approved";
    report.reviewedAt = format(new Date(), "dd.MM.yyyy");
    report.reviewerName = user ? `${user.firstName} ${user.lastName}` : "—";
    persistReports();
    onClose();
  };

  const handleReject = () => {
    if (!rejectComment.trim() && showRejectInput) return;
    report.status = "rejected";
    report.reviewerComment = rejectComment;
    report.reviewedAt = format(new Date(), "dd.MM.yyyy");
    report.reviewerName = user ? `${user.firstName} ${user.lastName}` : "—";
    persistReports();
    onClose();
  };

  const handleSubmitDraft = () => {
    report.status = "submitted";
    report.submittedAt = format(new Date(), "dd.MM.yyyy");
    report.programId = "prog-1";

    // Auto-calculate payout tier based on norm validation
    if (template?.fields) {
      let allMeetFull = true;
      let anyMeetBasic = false;
      for (const field of template.fields) {
        if (field.normFull == null) continue;
        const val = Number(report.data[field.key]);
        if (isNaN(val) || val < field.normFull) allMeetFull = false;
        if (!isNaN(val) && val >= (field.normBasic ?? 0)) anyMeetBasic = true;
      }
      report.payoutTier = allMeetFull ? 50000 : anyMeetBasic ? 25000 : 0;
    }

    persistReports();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">{template?.name ?? "Отчёт"}</h3>
            <p className="text-sm text-muted-foreground">
              {report.coachName} · {report.sport} · {report.group}
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
          Отчётный период: <span className="font-medium text-foreground">{report.periodStart}</span> – <span className="font-medium text-foreground">{report.periodEnd}</span>
          {report.submittedAt && <> · Отправлен: <span className="font-medium text-foreground">{report.submittedAt}</span></>}
          {report.reviewedAt && <> · Проверен: <span className="font-medium text-foreground">{report.reviewedAt}</span></>}
        </div>

        {/* Protocol link */}
        {report.commissionProtocolId && (
          <div className="border-b border-border px-6 py-2 flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-primary/60" />
            <span>Привязан к протоколу комиссии: <span className="font-medium text-foreground">{report.commissionProtocolId}</span></span>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4 px-6 py-4">
          {template?.fields.map((field) => {
            const value = report.data[field.key];
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
        </div>

        {/* Reviewer comment */}
        {report.reviewerComment && (
          <div className="mx-6 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <XCircle className="h-3.5 w-3.5" /> Комментарий проверяющего
            </div>
            <p className="mt-1 text-sm text-foreground">{report.reviewerComment}</p>
            {report.reviewerName && <p className="mt-1 text-xs text-muted-foreground">— {report.reviewerName}</p>}
          </div>
        )}

        {/* Signature */}
        <div className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Тренер-преподаватель:</span> _______________ / {report.coachName}
        </div>

        {/* Payout calculation (v8, Приложение №6) */}
        {report.payoutTier != null && report.payoutTier > 0 && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-secondary">Расчёт выплаты (Приложение №6)</span>
              <Badge variant="outline" className="text-xs font-normal">
                {report.payoutTier === 50000 ? "50 000 ₽" : "25 000 ₽"}
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-4 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              {(() => {
                const net = report.payoutTier;
                const gross = calculateGross(net, 13, 30.2);
                const ndfl = calculateNdf(gross, 13);
                const insurance = calculateInsurance(gross, 30.2);
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

        {/* Actions */}
        {isAdmin && report.status === "submitted" && (
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
                  <Button variant="outline" onClick={() => { setShowRejectInput(false); setRejectComment(""); }}>
                    Отмена
                  </Button>
                  <Button
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleReject}
                    disabled={!rejectComment.trim()}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Подтвердить отклонение
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setShowRejectInput(true)}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Отклонить
                  </Button>
                  <Button className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90" onClick={handleApprove}>
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Утвердить
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {report.status === "draft" && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => { onClose(); navigate({ to: "/reports/new" }); }}>
              Редактировать
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmitDraft}>
              <Send className="mr-1.5 h-4 w-4" /> Отправить на проверку
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
