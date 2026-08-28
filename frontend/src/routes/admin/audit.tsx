import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Filter } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Аудит-лог — СОКОЛ" },
      { name: "description", content: "Журнал действий пользователей в системе." },
    ],
  }),
  component: AdminAuditPage,
});

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface UserShort {
  id: string;
  email: string;
  last_name: string;
  first_name: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  login: "Вход",
  logout: "Выход",
  approve: "Утверждение",
  reject: "Отклонение",
  submit: "Отправка",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  login: "bg-gray-100 text-gray-800",
  approve: "bg-emerald-100 text-emerald-800",
  reject: "bg-orange-100 text-orange-800",
  submit: "bg-purple-100 text-purple-800",
};

function AdminAuditPage() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.roles.includes("superadmin") ?? false;
  const isAdmin = currentUser?.roles.includes("admin") ?? false;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("all");
  const [filterResource, setFilterResource] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "50" });
      if (filterAction !== "all") params.set("action", filterAction);
      if (filterResource) params.set("resource", filterResource);
      if (filterUser) params.set("user_id", filterUser);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const data = await apiFetch<{ data: AuditLogEntry[]; meta: { total: number } }>(`/audit-logs?${params}`);
      setLogs(data.data);
      setTotal(data.meta.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction, filterResource, filterUser, dateFrom, dateTo]);

  useEffect(() => {
    apiFetch<{ data: UserShort[] }>("/users?per_page=200")
      .then((d) => setUsers(d.data.map((u) => ({ id: u.id, name: `${u.last_name} ${u.first_name}`.trim() || u.email }))))
      .catch(() => {});
  }, []);

  if (!isSuperadmin && !isAdmin) {
    return (
      <AppShell title="Аудит-лог" subtitle="Журнал действий пользователей">
        <div className="p-8 text-center text-muted-foreground">Доступ запрещён</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Аудит-лог" subtitle="Журнал действий пользователей">
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Аудит-лог</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} записей</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все действия</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm max-w-56"
          >
            <option value="">Все пользователи</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="relative flex-1 max-w-xs">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ресурс (users, reports…)"
              className="pl-9"
              value={filterResource}
              onChange={(e) => { setFilterResource(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="h-9 w-40"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <span className="text-sm text-muted-foreground">—</span>
            <Input
              type="date"
              className="h-9 w-40"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Ресурс</TableHead>
                <TableHead>Объект</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Загрузка…</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Нет записей</TableCell></TableRow>
              ) : logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-sm">{log.user_id.slice(0, 8)}…</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] ?? ""}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.resource}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.resource_id ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.ip_address ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {total > 50 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button>
            <span className="text-sm text-muted-foreground self-center">Стр. {page}</span>
            <Button variant="outline" size="sm" disabled={logs.length < 50} onClick={() => setPage(page + 1)}>Далее</Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
