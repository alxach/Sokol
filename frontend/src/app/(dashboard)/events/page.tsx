"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Medal, Trophy, Users, ChevronRight } from "lucide-react";

const events = [
  {
    name: "Чемпионат России по самбо",
    dates: "12–15 окт",
    location: "Москва",
    participants: 248,
    status: "Подтверждён",
    type: "tournament",
  },
  {
    name: "Кубок федерации по дзюдо",
    dates: "22 окт",
    location: "Казань",
    participants: 120,
    status: "Брекеты",
    type: "tournament",
  },
  {
    name: "Первенство по каратэ U-18",
    dates: "5 ноя",
    location: "СПб",
    participants: 96,
    status: "Регистрация",
    type: "tournament",
  },
  {
    name: "Открытый турнир по боксу",
    dates: "18 ноя",
    location: "Омск",
    participants: 64,
    status: "Регистрация",
    type: "tournament",
  },
];

const timeline = [
  { dates: "12–15 окт", name: "Чемпионат России по самбо" },
  { dates: "22 окт", name: "Кубок федерации по дзюдо" },
  { dates: "5 ноя", name: "Первенство по каратэ U-18" },
  { dates: "18 ноя", name: "Открытый турнир по боксу" },
];

const statusColors: Record<string, "success" | "warning" | "info" | "neutral"> = {
  "Подтверждён": "success",
  "Брекеты": "info",
  "Регистрация": "warning",
};

export default function EventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
          <h1 className="text-2xl font-semibold text-brand-navy">События и соревнования</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Календарь, регистрация участников, брекеты и медали.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-neutral-500">Активные турниры</p>
              <p className="text-2xl font-semibold text-neutral-900">12</p>
            </div>
            <div className="text-neutral-400">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-neutral-500">Участники</p>
              <p className="text-2xl font-semibold text-neutral-900">1,842</p>
            </div>
            <div className="text-neutral-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-xs font-medium text-green-600">+212</span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-neutral-500">Медали (год)</p>
              <p className="text-2xl font-semibold text-neutral-900">248</p>
            </div>
            <div className="text-neutral-400">
              <Medal className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1">
              <p className="text-sm text-neutral-500">Russian Nationals</p>
              <p className="text-xs text-neutral-400">старт через 14 дней</p>
            </div>
            <button className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-light-blue transition-colors">
              Регистрация
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-neutral-100">
              <div className="h-2 rounded-full bg-brand-blue" style={{ width: "98%" }} />
            </div>
            <span className="text-xs font-medium text-neutral-600">98%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {events.map((ev, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{ev.name}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {ev.dates} · {ev.location}
                </p>
              </div>
              <Badge variant={statusColors[ev.status] ?? "neutral"}>{ev.status}</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-4">
              <Users className="h-3.5 w-3.5" />
              <span>Участников: {ev.participants}</span>
            </div>
            <div className="mt-auto flex gap-2">
              <button className="flex-1 rounded-lg bg-brand-blue py-2 text-xs font-medium text-white hover:bg-brand-light-blue transition-colors">
                Открыть
              </button>
              <button className="flex-1 rounded-lg border border-neutral-200 bg-white py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                Брекеты
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Календарь — таймлайн квартала</h2>
        <div className="space-y-0">
          {timeline.map((t, i) => (
            <div key={i} className="flex gap-4 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-brand-blue mt-1.5" />
                {i < timeline.length - 1 && <div className="w-px flex-1 bg-neutral-200" />}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-medium text-neutral-500 w-20 shrink-0">{t.dates}</span>
                <span className="text-sm text-neutral-900 truncate">{t.name}</span>
                <ChevronRight className="h-4 w-4 text-neutral-300 ml-auto shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
