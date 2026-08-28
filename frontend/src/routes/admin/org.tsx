import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, MapPin, Building2, Check } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/org")({
  head: () => ({
    meta: [
      { title: "Оргструктура — СОКОЛ" },
      { name: "description", content: "Регионы и центры сети." },
    ],
  }),
  component: AdminOrgPage,
});

interface Region {
  id: string;
  name: string;
  code: string;
}

interface Center {
  id: string;
  name: string;
  region_id: string | null;
  address: string | null;
  city: string | null;
  center_type: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

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

function AdminOrgPage() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.roles.includes("superadmin") ?? false;

  const [regions, setRegions] = useState<Region[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [msg, setMsg] = useState("");

  const [newRegion, setNewRegion] = useState({ name: "", code: "" });
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [editingRegionName, setEditingRegionName] = useState("");
  const [deleteRegionId, setDeleteRegionId] = useState<string | null>(null);

  const [centerOpen, setCenterOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [centerForm, setCenterForm] = useState({
    name: "", region_id: "", city: "", address: "", phone: "", email: "", center_type: "cse",
  });
  const [centerFormError, setCenterFormError] = useState("");
  const [centerSaving, setCenterSaving] = useState(false);
  const [deleteCenterId, setDeleteCenterId] = useState<string | null>(null);

  const fetchRegions = async () => {
    try {
      const data = await apiFetch<Region[]>("/organizations/regions");
      setRegions(data);
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  };

  const fetchCenters = async () => {
    try {
      const params = selectedRegion !== "all" ? `?region_id=${selectedRegion}` : "";
      const data = await apiFetch<Center[]>(`/organizations/centers${params}`);
      setCenters(data);
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  };

  useEffect(() => { fetchRegions(); }, []);
  useEffect(() => { fetchCenters(); }, [selectedRegion]);

  const handleAddRegion = async () => {
    setMsg("");
    if (!newRegion.name || !newRegion.code) return;
    try {
      await apiFetch("/organizations/regions", {
        method: "POST",
        body: JSON.stringify(newRegion),
      });
      setNewRegion({ name: "", code: "" });
      await fetchRegions();
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  };

  const saveRegionRename = async (id: string) => {
    setMsg("");
    try {
      await apiFetch(`/organizations/regions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingRegionName }),
      });
      setEditingRegion(null);
      await fetchRegions();
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  };

  const confirmDeleteRegion = async () => {
    if (!deleteRegionId) return;
    setMsg("");
    try {
      await apiFetch(`/organizations/regions/${deleteRegionId}`, { method: "DELETE" });
      setDeleteRegionId(null);
      const removed = regions.find((r) => r.id === deleteRegionId);
      if (removed && selectedRegion === removed.id) setSelectedRegion("all");
      await fetchRegions();
    } catch (err) {
      setMsg(apiErrorMessage(err));
      setDeleteRegionId(null);
    }
  };

  const openCreateCenter = () => {
    setEditingCenter(null);
    setCenterForm({
      name: "", region_id: selectedRegion !== "all" ? selectedRegion : (regions[0]?.id ?? ""),
      city: "", address: "", phone: "", email: "", center_type: "cse",
    });
    setCenterFormError("");
    setCenterOpen(true);
  };

  const openEditCenter = (c: Center) => {
    setEditingCenter(c);
    setCenterForm({
      name: c.name, region_id: c.region_id ?? "", city: c.city ?? "",
      address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "",
      center_type: c.center_type,
    });
    setCenterFormError("");
    setCenterOpen(true);
  };

  const saveCenter = async () => {
    setCenterFormError("");
    if (!centerForm.name) {
      setCenterFormError("Укажите название центра");
      return;
    }
    setCenterSaving(true);
    try {
      const body = {
        name: centerForm.name,
        region_id: centerForm.region_id || null,
        city: centerForm.city || null,
        address: centerForm.address || null,
        phone: centerForm.phone || null,
        email: centerForm.email || null,
        center_type: centerForm.center_type,
      };
      if (editingCenter) {
        await apiFetch(`/organizations/centers/${editingCenter.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/organizations/centers", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setCenterOpen(false);
      fetchCenters();
      fetchRegions();
    } catch (err) {
      setCenterFormError(apiErrorMessage(err));
    } finally {
      setCenterSaving(false);
    }
  };

  const toggleCenterActive = async (c: Center) => {
    setMsg("");
    try {
      await apiFetch(`/organizations/centers/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      fetchCenters();
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  };

  const confirmDeleteCenter = async () => {
    if (!deleteCenterId) return;
    setMsg("");
    try {
      await apiFetch(`/organizations/centers/${deleteCenterId}`, { method: "DELETE" });
      setDeleteCenterId(null);
      await fetchCenters();
      await fetchRegions();
    } catch (err) {
      setMsg(apiErrorMessage(err));
      setDeleteCenterId(null);
    }
  };

  if (!isSuperadmin) {
    return (
      <AppShell title="Оргструктура" subtitle="Регионы и центры сети">
        <div className="p-8 text-center text-muted-foreground">Доступ запрещён</div>
      </AppShell>
    );
  }

  const visibleCenters = centers;

  return (
    <AppShell title="Оргструктура" subtitle="Регионы и центры сети ЦСЕ">
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Оргструктура</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {regions.length} регионов · {visibleCenters.length} центров {selectedRegion !== "all" ? "в выбранном регионе" : "показано"}
          </p>
        </div>

        {msg && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{msg}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Регионы</h2>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-2 mb-3">
              <Input
                placeholder="Название"
                value={newRegion.name}
                onChange={(e) => setNewRegion({ ...newRegion, name: e.target.value })}
              />
              <Input
                placeholder="Код"
                value={newRegion.code}
                onChange={(e) => setNewRegion({ ...newRegion, code: e.target.value.toUpperCase() })}
                className="w-20"
              />
              <Button size="icon" onClick={handleAddRegion} disabled={!newRegion.name || !newRegion.code} title="Добавить регион">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedRegion("all")}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                  selectedRegion === "all" ? "bg-accent font-medium" : ""
                }`}
              >
                Все регионы
              </button>
              {regions.map((r) => (
                <div
                  key={r.id}
                  className={`group flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-colors hover:bg-accent ${
                    selectedRegion === r.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedRegion(r.id)}
                >
                  {editingRegion === r.id ? (
                    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                      <Input value={editingRegionName} onChange={(e) => setEditingRegionName(e.target.value)} className="h-7 flex-1" />
                      <Button size="icon" className="h-7 w-7" onClick={() => saveRegionRename(r.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate text-sm">{r.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{r.code}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Переименовать"
                          onClick={() => { setEditingRegion(r.id); setEditingRegionName(r.name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Удалить"
                          onClick={() => setDeleteRegionId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Центры</h2>
              </div>
              <Button size="sm" onClick={openCreateCenter}>
                <Plus className="h-4 w-4 mr-2" /> Добавить центр
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Город</TableHead>
                  <TableHead>Регион</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-28 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCenters.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Нет центров</TableCell></TableRow>
                ) : visibleCenters.map((c) => (
                  <TableRow key={c.id} className={c.is_active ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.city ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {regions.find((r) => r.id === c.region_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Активен" : "Закрыт"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Switch checked={c.is_active} onCheckedChange={() => toggleCenterActive(c)} title="Закрыть/открыть" />
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактировать" onClick={() => openEditCenter(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Удалить" onClick={() => setDeleteCenterId(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <Dialog open={centerOpen} onOpenChange={setCenterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCenter ? "Редактировать центр" : "Новый центр"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {centerFormError && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{centerFormError}</div>
            )}
            <div className="space-y-1.5">
              <Label>Название *</Label>
              <Input value={centerForm.name} onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Регион</Label>
              <Select value={centerForm.region_id} onValueChange={(v) => setCenterForm({ ...centerForm, region_id: v })}>
                <SelectTrigger><SelectValue placeholder="Без региона" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без региона</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Город</Label>
                <Input value={centerForm.city} onChange={(e) => setCenterForm({ ...centerForm, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Тип</Label>
                <Select value={centerForm.center_type} onValueChange={(v) => setCenterForm({ ...centerForm, center_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cse">ЦСЕ</SelectItem>
                    <SelectItem value="club">Спортклуб</SelectItem>
                    <SelectItem value="section">Секция</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Адрес</Label>
              <Input value={centerForm.address} onChange={(e) => setCenterForm({ ...centerForm, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Телефон</Label>
                <Input value={centerForm.phone} onChange={(e) => setCenterForm({ ...centerForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={centerForm.email} onChange={(e) => setCenterForm({ ...centerForm, email: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCenterOpen(false)}>Отмена</Button>
            <Button onClick={saveCenter} disabled={centerSaving}>
              {centerSaving ? "Сохранение…" : editingCenter ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteRegionId !== null} onOpenChange={(o) => { if (!o) setDeleteRegionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить регион?</AlertDialogTitle>
            <AlertDialogDescription>
              Регион с центрами удалить нельзя — сначала перенесите или удалите его центры.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRegion} className="bg-destructive hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteCenterId !== null} onOpenChange={(o) => { if (!o) setDeleteCenterId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить центр?</AlertDialogTitle>
            <AlertDialogDescription>
              Центр с привязанными данными удалить нельзя. Вместо удаления можно закрыть центр (переключить статус).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCenter} className="bg-destructive hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}