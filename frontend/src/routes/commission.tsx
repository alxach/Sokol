import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, Search, Eye, FileText, X, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth, useAuthGuard } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/commission")({
  head: () => ({
    meta: [
      { title: "Протоколы комиссии — СОКОЛ" },
      { name: "description", content: "Протоколы заседаний комиссии по материальному стимулированию." },
    ],
  }),
  component: CommissionPage,
});

interface PayoutRow {
  id: string;
  coachName: string;
  sport: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  ndflAmount: number;
  insuranceAmount: number;
  netAmount: number;
}

interface CommissionProtocol {
  id: string;
  number: string;
  date: string;
  beneficiaryName: string;
  period: string;
  centerId: string;
  centerName: string;
  agenda: string;
  decisions: string;
  votingFor: number;
  votingAgainst: number;
  votingAbstained: number;
  status: "draft" | "approved" | "rejected";
  reviewerComment?: string;
  payoutRows: PayoutRow[];
}

const mockProtocols: CommissionProtocol[] = [
  {
    id: "proto-1",
    number: "ПСМС-2026-001",
    date: "28.05.2026",
    beneficiaryName: "Благополучатель АНО «Центр Спорта и Здоровья»",
    period: "Апрель 2026",
    centerId: "center-1",
    centerName: "ЦСЕ «Сокол» — Москва",
    agenda: "Рассмотрение отчётов тренеров за апрель 2026 года и утверждение выплат.",
    decisions: "Утвердить выплаты тренерам согласно расчёту. Выплату произвести до 30.05.2026.",
    votingFor: 5,
    votingAgainst: 0,
    votingAbstained: 1,
    status: "approved",
    payoutRows: [
      { id: "pr-1", coachName: "Иванов И.И.", sport: "Дзюдо", periodStart: "01.04.2026", periodEnd: "30.04.2026", grossAmount: 32882.52, ndflAmount: 4274.73, insuranceAmount: 9931.52, netAmount: 25000 },
      { id: "pr-2", coachName: "Петрова А.С.", sport: "Фигурное катание", periodStart: "01.04.2026", periodEnd: "30.04.2026", grossAmount: 65765.04, ndflAmount: 8549.46, insuranceAmount: 19863.04, netAmount: 50000 },
    ],
  },
  {
    id: "proto-2",
    number: "ПСМС-2026-002",
    date: "27.06.2026",
    beneficiaryName: "Благополучатель АНО «Центр Спорта и Здоровья»",
    period: "Май 2026",
    centerId: "center-1",
    centerName: "ЦСЕ «Сокол» — Москва",
    agenda: "Рассмотрение отчётов тренеров за май 2026 года и утверждение выплат.",
    decisions: "Утвердить выплаты тренерам согласно расчёту.",
    votingFor: 4,
    votingAgainst: 0,
    votingAbstained: 0,
    status: "draft",
    payoutRows: [
      { id: "pr-3", coachName: "Иванов И.И.", sport: "Дзюдо", periodStart: "01.05.2026", periodEnd: "31.05.2026", grossAmount: 32882.52, ndflAmount: 4274.73, insuranceAmount: 9931.52, netAmount: 25000 },
    ],
  },
];

const statusConfig: Record<string, { label: string; style: string }> = {
  draft: { label: "Черновик", style: "text-muted-foreground border-border" },
  approved: { label: "Утверждён", style: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" },
  rejected: { label: "Отклонён", style: "text-destructive border-destructive/30 bg-destructive/5" },
};

function CommissionPage() {
  useAuthGuard();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState<CommissionProtocol | null>(null);
  const [expandedProtocols, setExpandedProtocols] = useState<Set<string>>(new Set());

  const filtered = mockProtocols.filter((p) =>
    p.number.toLowerCase().includes(search.toLowerCase()) ||
    p.centerName.toLowerCase().includes(search.toLowerCase()) ||
    p.period.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleExpand = (id: string) => {
    setExpandedProtocols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <AppShell title="Протоколы комиссии" subtitle="Материальное стимулирование тренеров">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-secondary">Протоколы комиссии</h1>
            <p className="text-sm text-muted-foreground">Материальное стимулирование тренеров (Приложение №6 Положения)</p>
          </div>
          {isAdmin && (
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1.5 h-4 w-4" /> Новый протокол
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру, центру или периоду..."
            className="pl-9"
          />
        </div>

        {/* Summary stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border border-border p-4">
            <div className="text-xs text-muted-foreground">Всего протоколов</div>
            <div className="mt-1 font-display text-2xl font-bold text-secondary">{mockProtocols.length}</div>
          </Card>
          <Card className="border border-border p-4">
            <div className="text-xs text-muted-foreground">Утверждено</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {mockProtocols.filter((p) => p.status === "approved").length}
            </div>
          </Card>
          <Card className="border border-border p-4">
            <div className="text-xs text-muted-foreground">Общая сумма выплат (брутто)</div>
            <div className="mt-1 font-display text-2xl font-bold text-secondary">
              {mockProtocols
                .filter((p) => p.status === "approved")
                .reduce((sum, p) => sum + p.payoutRows.reduce((s, r) => s + r.grossAmount, 0), 0)
                .toLocaleString("ru-RU")} ₽
            </div>
          </Card>
        </div>

        {/* Protocol list */}
        <div className="space-y-4">
          {filtered.map((protocol) => {
            const cfg = statusConfig[protocol.status];
            const isExpanded = expandedProtocols.has(protocol.id);
            const totalNet = protocol.payoutRows.reduce((s, r) => s + r.netAmount, 0);
            const totalGross = protocol.payoutRows.reduce((s, r) => s + r.grossAmount, 0);

            return (
              <Card key={protocol.id} className="border border-border p-0 overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(protocol.id)}>
                  <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setSelectedProtocol(protocol)}>
                    <FileText className="h-5 w-5 shrink-0 text-primary/60" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-secondary">{protocol.number}</span>
                        <Badge variant="outline" className={`font-normal text-[10px] ${cfg.style}`}>{cfg.label}</Badge>
                        <span className="text-xs text-muted-foreground">от {protocol.date}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {protocol.centerName} · {protocol.period} · Голоса: {protocol.votingFor}/{protocol.votingAgainst}/{protocol.votingAbstained}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-secondary">{totalNet.toLocaleString("ru-RU")} ₽</div>
                      <div className="text-xs text-muted-foreground">нетто</div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); toggleExpand(protocol.id); }}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="border-t border-border bg-muted/10 px-5 py-4 space-y-4">
                      {/* Protocol info */}
                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Благополучатель:</span>
                          <p className="font-medium text-foreground">{protocol.beneficiaryName}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Голосование:</span>
                          <p className="font-medium text-foreground">
                            За: {protocol.votingFor} · Против: {protocol.votingAgainst} · Воздержались: {protocol.votingAbstained}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Повестка:</span>
                          <p className="text-foreground">{protocol.agenda}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Решения:</span>
                          <p className="text-foreground">{protocol.decisions}</p>
                        </div>
                      </div>

                      {/* Payout table */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-secondary">Расчёт выплат (Приложение №6)</h4>
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
                              </tr>
                            </thead>
                            <tbody>
                              {protocol.payoutRows.map((row) => (
                                <tr key={row.id} className="border-b border-border last:border-0">
                                  <td className="px-3 py-2 font-medium text-foreground">{row.coachName}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{row.sport}</td>
                                  <td className="px-3 py-2 text-right text-muted-foreground">{row.periodStart} – {row.periodEnd}</td>
                                  <td className="px-3 py-2 text-right font-medium text-secondary">{row.netAmount.toLocaleString("ru-RU")} ₽</td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">−{row.ndflAmount.toLocaleString("ru-RU")} ₽</td>
                                  <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{row.insuranceAmount.toLocaleString("ru-RU")} ₽</td>
                                  <td className="px-3 py-2 text-right font-medium text-secondary">{row.grossAmount.toLocaleString("ru-RU")} ₽</td>
                                </tr>
                              ))}
                              <tr className="bg-muted/20 font-semibold">
                                <td colSpan={3} className="px-3 py-2 text-right text-foreground">Итого:</td>
                                <td className="px-3 py-2 text-right text-secondary">{totalNet.toLocaleString("ru-RU")} ₽</td>
                                <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">−{protocol.payoutRows.reduce((s, r) => s + r.ndflAmount, 0).toLocaleString("ru-RU")} ₽</td>
                                <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{protocol.payoutRows.reduce((s, r) => s + r.insuranceAmount, 0).toLocaleString("ru-RU")} ₽</td>
                                <td className="px-3 py-2 text-right text-secondary">{totalGross.toLocaleString("ru-RU")} ₽</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Actions */}
                      {isAdmin && protocol.status === "draft" && (
                        <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" size="sm">
                            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Отклонить
                          </Button>
                          <Button className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90" size="sm">
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Утвердить
                          </Button>
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

        {/* Discretionary disclaimer */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <span className="font-semibold">Обратите внимание:</span> Выплаты по настоящему Положению осуществляются на усмотрение Организации (п. 1.3). Наличие протокола Комиссии не гарантирует выплату.
        </div>
      </div>
    </AppShell>
  );
}
