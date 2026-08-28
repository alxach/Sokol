import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Pencil, KeyRound, Ban, Lock, Shield, Trash2, Copy, Check } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Пользователи — СОКОЛ" },
      { name: "description", content: "Управление пользователями системы." },
    ],
  }),
  component: AdminUsersPage,
});

interface RoleOut {
  id: string;
  code: string;
  name: string;
  is_system: boolean;
}

interface UserOut {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  is_active: boolean;
  center_id: string | null;
  roles: RoleOut[];
  created_at: string;
}

interface CenterOut {
  id: string;
  name: string;
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-100 text-red-800 border-red-200",
  director: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  coach: "bg-green-100 text-green-800 border-green-200",
  methodist: "bg-amber-100 text-amber-800 border-amber-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

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

function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.roles.includes("superadmin") ?? false;

  const [users, setUsers] = useState<UserOut[]>([]);
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [centers, setCenters] = useState<CenterOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserOut | null>(null);

  const [form, setForm] = useState({
    email: "", phone: "", password: "",
    first_name: "", last_name: "", middle_name: "",
    role_codes: [] as string[], center_id: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [rolesOpen, setRolesOpen] = useState(false);
  const [newRole, setNewRole] = useState({ code: "", name: "" });
  const [editingRoleCode, setEditingRoleCode] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [deleteRoleCode, setDeleteRoleCode] = useState<string | null>(null);
  const [rolesMsg, setRolesMsg] = useState("");

  const [resetUser, setResetUser] = useState<UserOut | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<UserOut | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "50" });
      if (search) params.set("search", search);
      if (filterRole !== "all") params.set("role", filterRole);
      const data = await apiFetch<{ data: UserOut[]; meta: { total: number } }>(`/users?${params}`);
      setUsers(data.data);
      setTotal(data.meta.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, search, filterRole]);

  const fetchRoles = async () => {
    try {
      const d = await apiFetch<{ data: RoleOut[] }>("/users/roles");
      setRoles(d.data);
    } catch (err) {
      setRolesMsg(apiErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchRoles();
    apiFetch<{ data: CenterOut[] }>("/organizations/centers")
      .then((d) => setCenters(d.data))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm({
      email: "", phone: "", password: "", first_name: "", last_name: "",
      middle_name: "", role_codes: ["coach"], center_id: "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (u: UserOut) => {
    setEditingUser(u);
    setForm({
      email: u.email, phone: u.phone, password: "",
      first_name: u.first_name, last_name: u.last_name, middle_name: u.middle_name ?? "",
      role_codes: u.roles.map((r) => r.code), center_id: u.center_id ?? "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const toggleRole = (code: string) => {
    setForm((f) => ({
      ...f,
      role_codes: f.role_codes.includes(code)
        ? f.role_codes.filter((c) => c !== code)
        : [...f.role_codes, code],
    }));
  };

  const handleSubmit = async () => {
    setFormError("");
    if (form.role_codes.length === 0) {
      setFormError("Выберите хотя бы одну роль");
      return;
    }
    setFormLoading(true);
    try {
      if (editingUser) {
        await apiFetch(`/users/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify({
            email: form.email, phone: form.phone,
            first_name: form.first_name, last_name: form.last_name,
            middle_name: form.middle_name || null,
            center_id: form.center_id || null,
          }),
        });
        await apiFetch(`/users/${editingUser.id}/roles`, {
          method: "POST",
          body: JSON.stringify({ role_codes: form.role_codes }),
        });
      } else {
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify({
            email: form.email, phone: form.phone, password: form.password,
            first_name: form.first_name, last_name: form.last_name,
            middle_name: form.middle_name || null,
            role_codes: form.role_codes,
            center_id: form.center_id || null,
          }),
        });
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      setFormError(apiErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddRole = async () => {
    setRolesMsg("");
    try {
      await apiFetch("/users/roles", {
        method: "POST",
        body: JSON.stringify(newRole),
      });
      setNewRole({ code: "", name: "" });
      await fetchRoles();
    } catch (err) {
      setRolesMsg(apiErrorMessage(err));
    }
  };

  const handleRenameRole = async (code: string) => {
    setRolesMsg("");
    try {
      await apiFetch(`/users/roles/${code}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingRoleName }),
      });
      setEditingRoleCode(null);
      await fetchRoles();
    } catch (err) {
      setRolesMsg(apiErrorMessage(err));
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteRoleCode) return;
    setRolesMsg("");
    try {
      await apiFetch(`/users/roles/${deleteRoleCode}`, { method: "DELETE" });
      setDeleteRoleCode(null);
      await fetchRoles();
    } catch (err) {
      setRolesMsg(apiErrorMessage(err));
      setDeleteRoleCode(null);
    }
  };

  const doResetPassword = async (u: UserOut) => {
    try {
      const res = await apiFetch<{ temporary_password: string }>(
        `/users/${u.id}/reset-password`, { method: "POST" },
      );
      setResetUser(null);
      setResetResult(res.temporary_password);
      setCopied(false);
    } catch (err) {
      setRolesMsg(apiErrorMessage(err));
    }
  };

  const doToggleActive = async (u: UserOut) => {
    setToggleBusy(true);
    try {
      await apiFetch(`/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      setToggleTarget(null);
      fetchUsers();
    } catch (err) {
      setRolesMsg(apiErrorMessage(err));
      setToggleTarget(null);
    } finally {
      setToggleBusy(false);
    }
  };

  const copyPassword = async () => {
    if (!resetResult) return;
    await navigator.clipboard.writeText(resetResult);
    setCopied(true);
  };

  if (!isSuperadmin) {
    return (
      <AppShell title="Пользователи" subtitle="Управление пользователями системы">
        <div className="p-8 text-center text-muted-foreground">Доступ запрещён</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Пользователи" subtitle="Управление пользователями системы">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Пользователи</h1>
            <p className="text-sm text-muted-foreground mt-1">{total} всего</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRolesOpen(true); setRolesMsg(""); }}>
              <Shield className="h-4 w-4 mr-2" /> Роли
            </Button>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Создать
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по ФИО, email, телефону…"
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все роли</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Роли</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-32 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Загрузка…</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Нет пользователей</TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id} className={u.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-medium">{u.last_name} {u.first_name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.id} variant="outline" className={`text-xs ${ROLE_COLORS[r.code] ?? ""}`}>
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "secondary"}>
                      {u.is_active ? "Активен" : "Заблокирован"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Редактировать" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Сбросить пароль" onClick={() => setResetUser(u)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        title={u.is_active ? "Заблокировать" : "Разблокировать"}
                        onClick={() => setToggleTarget(u)}
                      >
                        {u.is_active ? <Ban className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {total > 50 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button>
            <span className="text-sm text-muted-foreground self-center">Стр. {page}</span>
            <Button variant="outline" size="sm" disabled={users.length < 50} onClick={() => setPage(page + 1)}>Далее</Button>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Редактировать" : "Создать пользователя"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{formError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Фамилия *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Имя *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Отчество</Label>
              <Input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Телефон *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+79001234567" />
            </div>
            {!editingUser && (
              <div className="space-y-1.5">
                <Label>Пароль *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Роли *</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                {roles.map((r) => (
                  <label key={r.code} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.role_codes.includes(r.code)}
                      onCheckedChange={() => toggleRole(r.code)}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Центр</Label>
              <Select value={form.center_id} onValueChange={(v) => setForm({ ...form, center_id: v })}>
                <SelectTrigger><SelectValue placeholder="Без центра" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без центра</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? "Сохранение…" : editingUser ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Роли</DialogTitle>
            <DialogDescription>Системные роли нельзя редактировать и удалять.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {rolesMsg && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{rolesMsg}</div>
            )}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label>Код</Label>
                <Input
                  value={newRole.code}
                  placeholder="e.g. methodist"
                  onChange={(e) => setNewRole({ ...newRole, code: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Название</Label>
                <Input
                  value={newRole.name}
                  placeholder="Методист"
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                />
              </div>
              <Button onClick={handleAddRole} disabled={!newRole.code || !newRole.name}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="divide-y rounded-lg border">
              {roles.map((r) => (
                <div key={r.code} className="flex items-center gap-3 px-3 py-2">
                  {editingRoleCode === r.code ? (
                    <>
                      <Input
                        value={editingRoleName}
                        onChange={(e) => setEditingRoleName(e.target.value)}
                        className="h-8 flex-1"
                      />
                      <Button size="sm" onClick={() => handleRenameRole(r.code)}>Сохранить</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingRoleCode(null)}>Отмена</Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <span className="text-sm font-medium">{r.name}</span>
                        {r.is_system && (
                          <Badge variant="outline" className="ml-2 text-xs">Системная</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{r.code}</span>
                      {!r.is_system && (
                        <>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Переименовать"
                            onClick={() => { setEditingRoleCode(r.code); setEditingRoleName(r.name); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            title="Удалить"
                            onClick={() => setDeleteRoleCode(r.code)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteRoleCode !== null} onOpenChange={(o) => { if (!o) setDeleteRoleCode(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить роль?</AlertDialogTitle>
            <AlertDialogDescription>
              Пользователи с этой ролью потеряют доступ. Системные роли удалить нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRole} className="bg-destructive hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetUser !== null} onOpenChange={(o) => { if (!o) setResetUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сброс пароля</AlertDialogTitle>
            <AlertDialogDescription>
              Сгенерировать новый временный пароль для {resetUser?.last_name} {resetUser?.first_name}?
              Пароль будет показан один раз.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetUser && doResetPassword(resetUser)}>
              Сбросить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetResult !== null} onOpenChange={(o) => { if (!o) setResetResult(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Временный пароль</AlertDialogTitle>
            <AlertDialogDescription>
              Передайте пароль пользователю. Показан один раз.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-3">
            <span className="font-mono text-lg flex-1 break-all">{resetResult}</span>
            <Button variant="outline" size="icon" onClick={copyPassword} title="Скопировать">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Закрыть</Button>
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={toggleTarget !== null} onOpenChange={(o) => { if (!o) setToggleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.is_active ? "Заблокировать пользователя?" : "Разблокировать пользователя?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget && `${toggleTarget.last_name} ${toggleTarget.first_name} (${toggleTarget.email})`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleTarget && doToggleActive(toggleTarget)}
              className={toggleTarget?.is_active ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {toggleBusy ? "…" : toggleTarget?.is_active ? "Заблокировать" : "Разблокировать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}