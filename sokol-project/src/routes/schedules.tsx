import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Clock, MapPin, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard, useAuth } from "@/lib/auth";
import {
  schedules as allSchedules,
  groups as allGroups,
  type Schedule,
  type Discipline,
} from "@/lib/mock-data";

export const Route = createFileRoute("/schedules")({
  head: () => ({
    meta: [
      { title: "Расписание — СОКОЛ" },
      { name: "description", content: "Расписание тренировок." },
    ],
  }),
  component: SchedulesPage,
});

const dayNames = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const dayNamesShort = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function SchedulesPage() {
  const { loading, user } = useAuthGuard();
  const { isAdmin, isCoach } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState<string>("Все");
  const [showAdd, setShowAdd] = useState(false);

  const accessible = useMemo(() => {
    if (!user) return [];
    if (isCoach) return allSchedules.filter((s) => s.coachId === user.id);
    return allSchedules;
  }, [isCoach, user]);

  const userGroups = useMemo(() => {
    if (!user) return [];
    if (isCoach) return allGroups.filter((g) => g.coachId === user.id);
    return allGroups;
  }, [isCoach, user]);

  const filtered = useMemo(() => {
    if (selectedGroup === "Все") return accessible;
    return accessible.filter((s) => s.group === selectedGroup);
  }, [accessible, selectedGroup]);

  const groupedByDay = useMemo(() => {
    const map = new Map<number, Schedule[]>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const s of filtered) {
      map.get(s.dayOfWeek)?.push(s);
    }
    return map;
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <AppShell title="Расписание" subtitle="Расписание тренировок и занятий">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-secondary">
            {isCoach ? "Моё расписание" : "Расписание"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {accessible.length} занятий в неделю
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="Все">Все группы</option>
            {userGroups.map((g) => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
          {isCoach && (
            <Button onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Добавить занятие
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const daySchedules = groupedByDay.get(day) ?? [];
          return (
            <Card key={day} className="border border-border shadow-[var(--shadow-card)]">
              <div className="border-b border-border bg-muted/20 px-4 py-2.5">
                <h3 className="text-sm font-bold text-secondary">{dayNames[day - 1]}</h3>
                <p className="text-xs text-muted-foreground">{daySchedules.length} занятий</p>
              </div>
              <div className="space-y-2 p-3">
                {daySchedules.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Нет занятий</p>
                )}
                {daySchedules.map((s) => (
                  <div key={s.id} className="group relative rounded-lg border border-border bg-card p-3 transition hover:border-primary/30">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium text-foreground">{s.timeStart}</span>
                      <span>–</span>
                      <span className="font-medium text-foreground">{s.timeEnd}</span>
                    </div>
                    <p className="text-sm font-medium text-secondary">{s.group}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.room}
                      </span>
                      <Badge variant="outline" className="border-primary/30 bg-primary/5 font-normal text-primary text-[10px]">
                        {s.discipline}
                      </Badge>
                    </div>
                    {isCoach && (
                      <button
                        onClick={() => {
                          const idx = allSchedules.findIndex((x) => x.id === s.id);
                          if (idx !== -1) allSchedules.splice(idx, 1);
                        }}
                        className="absolute right-1.5 top-1.5 hidden rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive group-hover:block"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {showAdd && (
        <AddScheduleModal
          userGroups={userGroups}
          coachId={user?.id ?? ""}
          coachName={user?.coachName ?? ""}
          onClose={() => setShowAdd(false)}
        />
      )}
    </AppShell>
  );
}

function AddScheduleModal({
  userGroups,
  coachId,
  coachName,
  onClose,
}: {
  userGroups: typeof allGroups;
  coachId: string;
  coachName: string;
  onClose: () => void;
}) {
  const [groupId, setGroupId] = useState(userGroups[0]?.id ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timeStart, setTimeStart] = useState("09:00");
  const [timeEnd, setTimeEnd] = useState("10:30");
  const [room, setRoom] = useState("");

  const selectedGroup = userGroups.find((g) => g.id === groupId);

  const handleAdd = () => {
    const newId = `SCH-${String(allSchedules.length + 1).padStart(3, "0")}`;
    allSchedules.push({
      id: newId,
      coachId,
      coachName,
      group: selectedGroup?.name ?? "",
      discipline: (selectedGroup?.discipline ?? "Дзюдо") as Discipline,
      dayOfWeek,
      timeStart,
      timeEnd,
      room: room || "Не указано",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-secondary">Новое занятие</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Группа *</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {userGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name} · {g.discipline}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">День недели *</label>
            <div className="flex flex-wrap gap-1.5">
              {dayNamesShort.map((name, idx) => (
                <button
                  key={idx}
                  onClick={() => setDayOfWeek(idx + 1)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    dayOfWeek === idx + 1
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Начало *</label>
              <Input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Конец *</label>
              <Input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Зал / место</label>
            <Input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Зал А, спортзал…"
              className="h-9"
            />
          </div>
          <Button onClick={handleAdd} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>
    </div>
  );
}
