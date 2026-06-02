import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Search, CheckCircle, XCircle, Send, Eye } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reports, monthlyReportTemplate, type Report, type ReportStatus } from "@/lib/mock-data";

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

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
                    <Button variant="ghost" size="sm" onClick={() => setSelectedReport(r)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Открыть
                    </Button>
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
  const template = report.templateId === "TPL-001" ? monthlyReportTemplate : undefined;

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
            <Badge variant="outline" className={`font-normal ${statusConfig[report.status].style}`}>
              {statusConfig[report.status].label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Period */}
        <div className="border-b border-border px-6 py-3 text-sm text-muted-foreground">
          Отчётный период: <span className="font-medium text-foreground">{report.periodStart}</span> – <span className="font-medium text-foreground">{report.periodEnd}</span>
          {report.submittedAt && <> · Отправлен: <span className="font-medium text-foreground">{report.submittedAt}</span></>}
          {report.reviewedAt && <> · Проверен: <span className="font-medium text-foreground">{report.reviewedAt}</span></>}
        </div>

        {/* Fields */}
        <div className="space-y-4 px-6 py-4">
          {template?.fields.map((field) => {
            const value = report.data[field.key];
            return (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {field.label}
                  <span className="ml-2 italic text-muted-foreground/60">(норма: {field.norm})</span>
                </label>
                {field.type === "number" ? (
                  <div className="text-2xl font-display font-bold text-secondary">{String(value ?? "—")}</div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground whitespace-pre-wrap">
                    {(value as string) || "—"}
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

        {/* Actions */}
        {isAdmin && report.status === "submitted" && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
              <XCircle className="mr-1.5 h-4 w-4" /> Отклонить
            </Button>
            <Button className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90">
              <CheckCircle className="mr-1.5 h-4 w-4" /> Утвердить
            </Button>
          </div>
        )}

        {report.status === "draft" && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Link to="/reports/new">
              <Button variant="outline">Редактировать</Button>
            </Link>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="mr-1.5 h-4 w-4" /> Отправить на проверку
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
