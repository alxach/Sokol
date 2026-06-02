"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/badge";
import { Users, UserCircle, TrendingUp, Activity } from "lucide-react";
import {
  useDashboardAnalytics,
  useAttendanceStats,
  useEventsStats,
  useAthletesList,
  useCoachesList,
} from "@/hooks/use-dashboard";

const activityFeed = [
  { text: "QR check-in: Центральный додзё", time: "2 мин", user: "Иван Петров" },
  { text: "Сдан месячный отчёт", time: "15 мин", user: "Региональный менеджер: Омск" },
  { text: "Зарегистрирован новый тренер", time: "1 ч", user: "Марина Соколова" },
  { text: "Аномалия посещаемости (СОКОЛ AI)", time: "3 ч", user: "Филиал Омск" },
];

const statusLabels: Record<string, string> = {
  active: "ACTIVE",
  vacation: "VACATION",
  injury: "INJURY",
  inactive: "INACTIVE",
};

export default function DashboardPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const analytics = useDashboardAnalytics();
  const athletes = useAthletesList(1, 100);
  const coaches = useCoachesList(1, 100);
  const attendanceStats = useAttendanceStats();
  const eventsStats = useEventsStats();

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

  const athleteCount = athletes.data?.[0]?.length ?? 0;
  const coachCount = coaches.data?.[0]?.length ?? 0;
  const todayRate = attendanceStats.data?.today_rate ?? 0;
  const todayDiff = attendanceStats.data?.today_diff ?? 0;
  const weekRate = attendanceStats.data?.week_rate ?? 0;
  const eventReadiness = eventsStats.data?.readiness_pct ?? 0;
  const nextEvent = eventsStats.data?.next_event_name ?? "";
  const topRegion = analytics.data?.top_region;

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Мои спортсмены</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {user.first_name} {user.last_name}, сегодня у вас {athleteCount} спортсменов.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Спортсменов"
            value={String(athleteCount)}
            subtitle="в вашей группе"
            icon={<Users className="h-5 w-5" />}
          />
          <MetricCard
            label="Посещаемость (сегодня)"
            value={`${todayRate}%`}
            subtitle={`${todayDiff >= 0 ? "+" : ""}${todayDiff}%`}
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            label="Средняя посещаемость"
            value={`${weekRate}%`}
            subtitle="за последние 7 дней"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            label="Предстоящие события"
            value={String(eventsStats.data?.active_tournaments ?? 0)}
            subtitle={nextEvent || "нет"}
            icon={<UserCircle className="h-5 w-5" />}
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Мои спортсмены</h2>
          <div className="space-y-3">
            {(athletes.data?.[0] ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {a.last_name} {a.first_name}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {a.sport_type} · {a.rank || "без разряда"}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={statusLabels[a.status] || "ACTIVE"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalAthletes = athleteCount.toLocaleString();
  const totalCoaches = coachCount.toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-navy">Общий обзор федерации</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Оперативные данные по состоянию секций, посещаемости и результативности за текущий период.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Athletes"
          value={totalAthletes}
          subtitle={`Рост ${analytics.data?.growth_yoy ?? 0}% год к году`}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Active Coaches"
          value={totalCoaches}
          subtitle={topRegion ? `Топ-регион: ${topRegion.name}` : ""}
          icon={<UserCircle className="h-5 w-5" />}
        />
        <MetricCard
          label="Avg Attendance"
          value={`${todayRate}%`}
          subtitle={`${todayDiff >= 0 ? "+" : ""}${todayDiff}% — сегодня`}
          icon={<Activity className="h-5 w-5" />}
        />
        <MetricCard
          label="Event Readiness"
          value={`${eventReadiness}%`}
          subtitle={nextEvent || ""}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-900">Динамика посещаемости</h2>
            <div className="flex gap-1">
              {["Week", "Month", "Year"].map((t) => (
                <button
                  key={t}
                  className="rounded-md px-3 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 data-[active=true]:bg-brand-blue data-[active=true]:text-white"
                  data-active={t === "Month"}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 h-48">
            {(analytics.data?.quarterly_trends ?? []).slice(-7).map((q, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-brand-blue/80 transition-all"
                  style={{ height: `${q.attendance}%` }}
                />
                <span className="text-[10px] text-neutral-400">{q.quarter}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Лента активности</h2>
          <div className="space-y-4">
            {activityFeed.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-brand-blue shrink-0" />
                <div>
                  <p className="text-sm text-neutral-700">{item.text}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {item.user} • {item.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 text-xs font-medium text-brand-blue hover:text-brand-blue-hover">
            Открыть Audit Log →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Регионы — спортсмены</h2>
          <div className="space-y-3">
            {(analytics.data?.region_efficiency ?? []).map((r) => {
              const maxVal = Math.max(...(analytics.data?.region_efficiency ?? []).map((x) => x.athletes), 1);
              return (
                <div key={r.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-700">{r.name}</span>
                    <span className="text-neutral-400">{r.athletes}</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full bg-brand-blue transition-all"
                      style={{ width: `${(r.athletes / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Дисциплины</h2>
          <div className="space-y-4">
            {[
              { name: "Самбо", pct: 38, color: "bg-brand-blue" },
              { name: "Дзюдо", pct: 26, color: "bg-brand-light-blue" },
              { name: "Каратэ", pct: 18, color: "bg-brand-orange" },
              { name: "Бокс", pct: 12, color: "bg-red-500" },
              { name: "Прочее", pct: 6, color: "bg-neutral-300" },
            ].map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <div className={cn("h-3 w-3 rounded-full shrink-0", d.color)} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-700">{d.name}</span>
                    <span className="text-neutral-500">{d.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Лучшие спортсмены</h2>
          <div className="space-y-3">
            {(athletes.data?.[0] ?? []).slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {a.last_name} {a.first_name}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {a.sport_type} · {a.rank || "без разряда"}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={statusLabels[a.status] || "ACTIVE"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
