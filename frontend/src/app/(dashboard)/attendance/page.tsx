"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { CalendarDays, QrCode, Send, TrendingDown, TrendingUp, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const heatmapData = Array.from({ length: 28 }, (_, i) => ({
  date: new Date(Date.now() - (27 - i) * 86400000),
  rate: [0.92, 0.88, 0.95, 0.78, 0.85, 0.91, 0.97, 0.82, 0.79, 0.94, 0.89, 0.87, 0.93, 0.86, 0.78, 0.96, 0.91, 0.84, 0.88, 0.9, 0.95, 0.87, 0.83, 0.92, 0.94, 0.89, 0.97, 0.91][i] ?? 0.85,
}));

const trainings = [
  { group: "Группа А-1", discipline: "Самбо", coach: "М. Соколова", start: "16:00", enrolled: 20, present: 18 },
  { group: "Группа Б-3", discipline: "Дзюдо", coach: "А. Орлов", start: "17:30", enrolled: 18, present: 14 },
  { group: "Группа В-2", discipline: "Каратэ", coach: "В. Лебедев", start: "18:00", enrolled: 16, present: 12 },
];

function getHeatColor(rate: number): string {
  if (rate >= 0.95) return "bg-green-500";
  if (rate >= 0.9) return "bg-green-400";
  if (rate >= 0.85) return "bg-green-300";
  if (rate >= 0.8) return "bg-amber-300";
  if (rate >= 0.75) return "bg-orange-300";
  return "bg-red-300";
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("ru-RU", { weekday: "short" }).slice(0, 2);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function AttendancePage() {
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Журнал посещаемости</h1>
          <p className="mt-1 text-sm text-neutral-500">
            QR check-in, Telegram-интеграция и мобильный режим для тренеров.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
            <QrCode className="h-4 w-4" />
            QR Check-in
          </button>
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-400 cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
            Telegram-уведомление
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Сегодня"
          value="91.4%"
          trend="+1.2%"
          trendUp
          icon={<UserCheck className="h-5 w-5" />}
        />
        <MetricCard
          label="Эта неделя"
          value="89.1%"
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <MetricCard
          label="Месяц"
          value="88.7%"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <MetricCard
          label="Пропуски"
          value="142"
          trend="-18"
          trendUp
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">
            Календарь — тепловая карта (28 дней)
          </h2>
          <div className="flex items-center justify-between mb-3 text-xs text-neutral-400">
            <span>меньше</span>
            <div className="flex gap-0.5">
              {["bg-red-300", "bg-orange-300", "bg-amber-300", "bg-green-300", "bg-green-400", "bg-green-500"].map(
                (c) => (
                  <div key={c} className={cn("h-3 w-3 rounded-sm", c)} />
                ),
              )}
            </div>
            <span>больше</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-neutral-400 uppercase">
                {d}
              </div>
            ))}
            {Array.from({ length: new Date(heatmapData[0].date).getDay() === 0 ? 6 : new Date(heatmapData[0].date).getDay() - 1 }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {heatmapData.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "aspect-square rounded-md flex items-center justify-center text-[10px] font-medium text-white",
                  getHeatColor(d.rate),
                )}
                title={`${formatDate(d.date)} — ${(d.rate * 100).toFixed(0)}%`}
              >
                {d.date.getDate()}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-900">Сегодняшние тренировки</h2>
            <Badge variant="info">3 активные</Badge>
          </div>
          <div className="space-y-3">
            {trainings.map((t, i) => (
              <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{t.group}</p>
                    <p className="text-xs text-neutral-500">{t.discipline}</p>
                  </div>
                  <span className="text-sm font-semibold text-neutral-700">{t.start}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{t.coach}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">
                    {t.present}/{t.enrolled}
                  </span>
                  <div className="flex gap-1.5">
                    <button className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-light-blue transition-colors">
                      Отметить
                    </button>
                    <button className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                      Пропуск
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
