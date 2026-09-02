import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Plus, Search, FileText, X, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Pencil, Trash2, UserPlus, HandCoins,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  type CommissionProtocolDto, type ProtocolStatus,
  type CommissionProtocolCreatePayload, type CommissionProtocolUpdatePayload, type PayoutRowDto,
  fetchProtocols, createProtocol, updateProtocol, deleteProtocol,
  approveProtocol, rejectProtocol, addPayoutRow, deletePayoutRow,
} from "@/lib/api/commission.functions";
import { fetchCenters, type Center } from "@/lib/api/organizations.functions";
import { fetchCoaches, type CoachDto } from "@/lib/api/coaches.functions";

export const Route = createFileRoute("/commission")({
  head: () => ({
    meta: [
      { title: "Протоколы комиссии — СОКОЛ" },
      { name: "description", content: "Протоколы заседаний комиссии по материальному стимулированию." },
    ],
  }),
  component: CommissionPage,
});

const statusConfig: Record<ProtocolStatus, { label: string; style: string }> = {
  draft: { label: "Черновик", style: "text-muted-foreground border-border" },
  approved: { label: "Утверждён", style: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" },
  rejected: { label: "Отклонён", style: "text-destructive border-destructive/30 bg-destructive/5" },
};

function toRuDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, "dd.MM.yyyy");
}

function fmtMoney(value: string | number | null | undefined): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "0";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function CommissionPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isDirector, isSuperadmin } = useAuth();
  const canManage = isAdmin || isDirector || isSuperadmin;
  const [search, setSearch] = useState("");
  const [protocols, setProtocols] = useState<CommissionProtocolDto[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formModal, setFormModal] = useState<{ open: boolean; editing: CommissionProtocolDto | null }>({ open: false, editing: null });
  const [rowModalProtocol, setRowModalProtocol] = useState<CommissionProtocolDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CommissionProtocolDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, centerList, coachList] = await Promise.all([
        fetchProtocols(),
        canManage ? fetchCenters() : Promise.resolve([]),
        canManage ? fetchCoaches() : Promise.resolve([]),
      ]);
      setProtocols(list);
      setCenters(centerList);
      setCoaches(coachList);
    } catch (err) {
      console.error("Ошибка загрузки протоколов:", err);
      setError("Не удалось загрузить протоколы комиссии.");
    }
  }, [canManage]);

  useEffect(() => { void load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setError("Не удалось выполнить действие. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = (p: CommissionProtocolDto) => run(`approve-${p.id}`, async () => {
    await approveProtocol(p.id);
    await load();
  });

  const handleReject = (p: CommissionProtocolDto, comment: string) => run(`reject-${p.id}`, async () => {
    await rejectProtocol(p.id, comment);
    setRejectTarget(null);
    await load();
  });

  const handleDelete = (p: CommissionProtocolDto) => {
    if (!window.confirm(`Удалить протокол ${p.number}?`)) return;
    void run(`delete-${p.id}`, async () => {
      await deleteProtocol(p.id);
      await load();
    });
  };

  const handleSaveProtocol = (payload: CommissionProtocolUpdatePayload, id?: string) =>
    run(id ? `edit-${id}` : "create", async () => {
      if (id) await updateProtocol(id, payload);
      else await createProtocol(payload as CommissionProtocolCreatePayload);
      setFormModal({ open: false, editing: null });
      await load();
    });

  const handleAddRow = (p: CommissionProtocolDto, coachId: string, sportType: string, periodStart: string, periodEnd: string, grossAmount: string) =>
    run(`row-${p.id}`, async () => {
      await addPayoutRow(p.id, {
        coach_id: coachId,
        sport_type: sportType,
        period_start: periodStart,
        period_end: periodEnd,
        gross_amount: grossAmount,
      });
      setRowModalProtocol(null);
      await load();
    });

  const handleDeleteRow = (p: CommissionProtocolDto, row: PayoutRowDto) => {
    if (!window.confirm(`Удалить выплату тренера ${row.coach_name}?`)) return;
    void run(`delrow-${row.id}`, async () => {
      await deletePayoutRow(p.id, row.id);
      await load();
    });
  };

  const q = search.trim().toLowerCase();
  const filtered = protocols.filter((p) =>
    !q ||
    p.number.toLowerCase().includes(q) ||
    p.center_name.toLowerCase().includes(q) ||
    p.period.toLowerCase().includes(q),
  );
  const approvedTotal = protocols
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.payout_rows.reduce((s, r) => s + Number(r.gross_amount), 0), 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <AppShell title="Протоколы комиссии" subtitle="Материальное стимулирование тренеров">
        <Card className="border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Доступ к протоколам комиссии есть только у администратора и директора.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Протоколы комиссии" subtitle="Материальное стимулирование тренеров">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-secondary">Протоколы комиссии</h1>
            <p className="text-sm text-muted-foreground">Материальное стимулирование тренеров (Приложение №6 Положения)</p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setFormModal({ open: true, editing: null })}>
            <Plus className="mr-1.5 h-4 w-4" /> Новый протокол
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру, центру или периоду..."
            className="pl-9"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border border-border p-4">
            <div className="text-xs text-muted-foreground">Всего протоколов</div>
            <div className="mt-1 font-display text-2xl font-bold text-secondary">{protocols.length}</div>
          </Card>
          <Card className="border border-border p-4">
            <div className="text-xs text-muted-foreground">Утверждено</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {protocols.filter((p) => p.status === "approved").length}
            </div>
          </Card>
          <Card className="border border-border p-4">
            <div className="text-xs text-muted-foreground">Общая сумма выплат (брутто)</div>
            <div className="mt-1 font-display text-2xl font-bold text-secondary">{fmtMoney(approvedTotal)} ₽</div>
          </Card>
        </div>

        <div className="space-y-4">
          {filtered.map((protocol) => {
            const cfg = statusConfig[protocol.status];
            const isExpanded = expanded.has(protocol.id);
            const totalNet = protocol.payout_rows.reduce((s, r) => s + Number(r.net_amount), 0);
            const totalGross = protocol.payout_rows.reduce((s, r) => s + Number(r.gross_amount), 0);
            const isDraft = protocol.status === "draft";
            const busyKey = busy === `approve-${protocol.id}` || busy === `reject-${protocol.id}` || busy === `delete-${protocol.id}` || busy === `row-${protocol.id}`;

            return (
              <Card key={protocol.id} className="border border-border overflow-hidden p-0">
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(protocol.id)}>
                  <div className="flex items-center gap-3 px-5 py-4">
                    <FileText className="h-5 w-5 shrink-0 text-primary/60" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-secondary">{protocol.number}</span>
                        <Badge variant="outline" className={`font-normal text-[10px] ${cfg.style}`}>{cfg.label}</Badge>
                        <span className="text-xs text-muted-foreground">от {toRuDate(protocol.date)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {protocol.center_name} · {protocol.period} · Голоса: {protocol.voting_for}/{protocol.voting_against}/{protocol.voting_abstained}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium text-secondary">{fmtMoney(totalNet)} ₽</div>
                      <div className="text-xs text-muted-foreground">нетто</div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-4 border-t border-border bg-muted/10 px-5 py-4">
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Благополучатель:</span>
                          <p className="font-medium text-foreground">{protocol.beneficiary_name}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Голосование:</span>
                          <p className="font-medium text-foreground">
                            За: {protocol.voting_for} · Против: {protocol.voting_against} · Воздержались: {protocol.voting_abstained}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Повестка:</span>
                          <p className="text-foreground">{protocol.agenda || "—"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Решения:</span>
                          <p className="text-foreground">{protocol.decisions || "—"}</p>
                        </div>
                        {protocol.status !== "draft" && protocol.review_comment && (
                          <div>
                            <span className="text-xs text-muted-foreground">Комментарий:</span>
                            <p className="text-foreground">{protocol.review_comment}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-secondary">Расчёт выплат (Приложение №6)</h4>
                          {isDraft && (
                            <Button variant="outline" size="sm" onClick={() => setRowModalProtocol(protocol)}>
                              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Добавить строку
                            </Button>
                          )}
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Тренер</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Вид спорта</th>
                                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Период</th>
                                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Нетто</th>
                                <th className="px-3 py-2 text-right font-medium text-muted-foreground">НДФЛ</th>
                                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Взносы</th>
                                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Брутто</th>
                                {isDraft && <th className="px-3 py-2" />}
                              </tr>
                            </thead>
                            <tbody>
                              {protocol.payout_rows.map((row) => (
                                <tr key={row.id} className="border-b border-border last:border-0">
                                  <td className="px-3 py-2 font-medium text-foreground">{row.coach_name}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{row.sport_type}</td>
                                  <td className="px-3 py-2 text-right text-muted-foreground">{toRuDate(row.period_start)} – {toRuDate(row.period_end)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-secondary">{fmtMoney(row.net_amount)} ₽</td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">−{fmtMoney(row.ndfl_amount)} ₽</td>
                                  <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{fmtMoney(row.insurance_amount)} ₽</td>
                                  <td className="px-3 py-2 text-right font-medium text-secondary">{fmtMoney(row.gross_amount)} ₽</td>
                                  {isDraft && (
                                    <td className="px-3 py-2 text-right">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Удалить строку" onClick={() => handleDeleteRow(protocol, row)}>
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                              {protocol.payout_rows.length === 0 && (
                                <tr>
                                  <td colSpan={isDraft ? 8 : 7} className="px-3 py-4 text-center text-muted-foreground">
                                    Строки выплат не добавлены
                                  </td>
                                </tr>
                              )}
                              {protocol.payout_rows.length > 0 && (
                                <tr className="bg-muted/20 font-semibold">
                                  <td colSpan={3} className="px-3 py-2 text-right text-foreground">Итого:</td>
                                  <td className="px-3 py-2 text-right text-secondary">{fmtMoney(totalNet)} ₽</td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">−{fmtMoney(protocol.payout_rows.reduce((s, r) => s + Number(r.ndfl_amount), 0))} ₽</td>
                                  <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{fmtMoney(protocol.payout_rows.reduce((s, r) => s + Number(r.insurance_amount), 0))} ₽</td>
                                  <td className="px-3 py-2 text-right text-secondary">{fmtMoney(totalGross)} ₽</td>
                                  {isDraft && <td className="px-3 py-2" />}
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {(isDraft || protocol.review_comment) && (
                        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
                          {protocol.status === "draft" && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setFormModal({ open: true, editing: protocol })} disabled={busyKey}>
                                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Редактировать
                              </Button>
                              <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setRejectTarget(protocol)} disabled={busyKey}>
                                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Отклонить
                              </Button>
                              <Button
                                size="sm"
                                className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90"
                                onClick={() => handleApprove(protocol)}
                                disabled={busyKey}
                              >
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Утвердить
                              </Button>
                              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleDelete(protocol)} disabled={busyKey}>
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Удалить
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card className="border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Протоколы не найдены</p>
            </Card>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <span className="font-semibold">Обратите внимание:</span> Выплаты по настоящему Положению осуществляются на усмотрение Организации (п. 1.3). Наличие протокола Комиссии не гарантирует выплату.
        </div>
      </div>

      {formModal.open && (
        <ProtocolFormModal
          protocol={formModal.editing}
          centers={centers}
          adminCenterId={isAdmin && !isSuperadmin ? user?.centerId ?? null : null}
          onSave={handleSaveProtocol}
          onClose={() => setFormModal({ open: false, editing: null })}
          saving={busy !== null}
        />
      )}

      {rowModalProtocol && (
        <PayoutRowFormModal
          protocol={rowModalProtocol}
          coaches={coaches}
          onSave={handleAddRow}
          onClose={() => setRowModalProtocol(null)}
          saving={busy !== null}
        />
      )}

      {rejectTarget && (
        <RejectModal
          protocol={rejectTarget}
          onSave={(comment) => handleReject(rejectTarget, comment)}
          onClose={() => setRejectTarget(null)}
          saving={busy !== null}
        />
      )}
    </AppShell>
  );
}

function ProtocolFormModal({
  protocol, centers, adminCenterId, onSave, onClose, saving,
}: {
  protocol: CommissionProtocolDto | null;
  centers: Center[];
  adminCenterId: string | null;
  onSave: (payload: CommissionProtocolUpdatePayload, id?: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [number, setNumber] = useState(protocol?.number ?? "");
  const [date, setDate] = useState(protocol?.date ?? "");
  const [beneficiaryName, setBeneficiaryName] = useState(protocol?.beneficiary_name ?? "");
  const [period, setPeriod] = useState(protocol?.period ?? "");
  const [centerId, setCenterId] = useState(protocol?.center_id ?? adminCenterId ?? "");
  const [agenda, setAgenda] = useState(protocol?.agenda ?? "");
  const [decisions, setDecisions] = useState(protocol?.decisions ?? "");
  const [votingFor, setVotingFor] = useState(String(protocol?.voting_for ?? 0));
  const [votingAgainst, setVotingAgainst] = useState(String(protocol?.voting_against ?? 0));
  const [votingAbstained, setVotingAbstained] = useState(String(protocol?.voting_abstained ?? 0));
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (!number.trim() || !date || !beneficiaryName.trim() || !period.trim() || !centerId) {
      setLocalError("Заполните номер, дату, благополучателя, период и центр.");
      return;
    }
    onSave({
      number: number.trim(),
      date,
      beneficiary_name: beneficiaryName.trim(),
      period: period.trim(),
      center_id: centerId,
      agenda: agenda.trim() || null,
      decisions: decisions.trim() || null,
      voting_for: Number(votingFor) || 0,
      voting_against: Number(votingAgainst) || 0,
      voting_abstained: Number(votingAbstained) || 0,
    }, protocol?.id);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{protocol ? "Редактировать протокол" : "Новый протокол"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {localError && <p className="text-sm text-destructive">{localError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proto-number">Номер</Label>
              <Input id="proto-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ПСМС-2026-003" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proto-date">Дата</Label>
              <Input id="proto-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proto-beneficiary">Благополучатель</Label>
            <Input id="proto-beneficiary" value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} placeholder="АНО «Центр Спорта и Здоровья»" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proto-period">Период</Label>
              <Input id="proto-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Август 2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Центр</Label>
              <Select value={centerId} onValueChange={setCenterId} disabled={!!adminCenterId}>
                <SelectTrigger><SelectValue placeholder="Выберите центр" /></SelectTrigger>
                <SelectContent>
                  {adminCenterId && (
                    <SelectItem value={adminCenterId}>
                      {centers.find((c) => c.id === adminCenterId)?.name ?? "Ваш центр"}
                    </SelectItem>
                  )}
                  {!adminCenterId && centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proto-agenda">Повестка</Label>
            <Textarea id="proto-agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={2} placeholder="Рассмотрение отчётов тренеров и утверждение выплат…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proto-decisions">Решения</Label>
            <Textarea id="proto-decisions" value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={2} placeholder="Утвердить выплаты тренерам согласно расчёту…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proto-for">За</Label>
              <Input id="proto-for" type="number" min={0} value={votingFor} onChange={(e) => setVotingFor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proto-against">Против</Label>
              <Input id="proto-against" type="number" min={0} value={votingAgainst} onChange={(e) => setVotingAgainst(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proto-abstained">Воздержались</Label>
              <Input id="proto-abstained" type="number" min={0} value={votingAbstained} onChange={(e) => setVotingAbstained(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={submit} disabled={saving}>
              <HandCoins className="mr-1.5 h-4 w-4" /> {protocol ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PayoutRowFormModal({
  protocol, coaches, onSave, onClose, saving,
}: {
  protocol: CommissionProtocolDto;
  coaches: CoachDto[];
  onSave: (p: CommissionProtocolDto, coachId: string, sportType: string, periodStart: string, periodEnd: string, grossAmount: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [coachId, setCoachId] = useState("");
  const [sportType, setSportType] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (!coachId || !sportType.trim() || !periodStart || !periodEnd || !grossAmount) {
      setLocalError("Заполните тренера, вид спорта, период и сумму брутто.");
      return;
    }
    onSave(protocol, coachId, sportType.trim(), periodStart, periodEnd, grossAmount.replace(",", "."));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить строку выплаты — {protocol.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {localError && <p className="text-sm text-destructive">{localError}</p>}
          <div className="space-y-1.5">
            <Label>Тренер</Label>
            <Select value={coachId} onValueChange={setCoachId}>
              <SelectTrigger><SelectValue placeholder="Выберите тренера" /></SelectTrigger>
              <SelectContent>
                {coaches.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="row-sport">Вид спорта</Label>
            <Input id="row-sport" value={sportType} onChange={(e) => setSportType(e.target.value)} placeholder="Дзюдо" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="row-start">Период с</Label>
              <Input id="row-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="row-end">Период по</Label>
              <Input id="row-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="row-gross">Сумма брутто, ₽</Label>
            <Input id="row-gross" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} placeholder="74827.24" inputMode="decimal" />
            <p className="text-xs text-muted-foreground">НДФЛ, страховые взносы и сумма нетто будут рассчитаны автоматически по Приложению №6.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={submit} disabled={saving}>
              <Plus className="mr-1.5 h-4 w-4" /> Добавить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RejectModal({
  protocol, onSave, onClose, saving,
}: {
  protocol: CommissionProtocolDto;
  onSave: (comment: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (!comment.trim()) {
      setLocalError("Укажите причину отклонения.");
      return;
    }
    onSave(comment.trim());
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Отклонить протокол {protocol.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {localError && <p className="text-sm text-destructive">{localError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="reject-comment">Причина отклонения</Label>
            <Textarea id="reject-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Документы неполные…" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
            <Button className="border-destructive bg-destructive text-white hover:bg-destructive/90" onClick={submit} disabled={saving}>
              <XCircle className="mr-1.5 h-4 w-4" /> Отклонить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}