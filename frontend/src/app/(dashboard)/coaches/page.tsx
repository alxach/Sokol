"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Users, Wifi, BarChart3, ShieldCheck } from "lucide-react";

const coaches = [
  { name: "Марина Соколова", region: "Москва", groups: 6, athletes: 92, kpi: 94, status: "ONLINE" },
  { name: "Андрей Орлов", region: "СПб", groups: 4, athletes: 64, kpi: 88, status: "ONLINE" },
  { name: "Виктор Лебедев", region: "Казань", groups: 5, athletes: 78, kpi: 82, status: "OFFLINE" },
  { name: "Алексей Соловьёв", region: "Екб", groups: 3, athletes: 48, kpi: 76, status: "ONLINE" },
  { name: "Татьяна Жукова", region: "Омск", groups: 4, athletes: 56, kpi: 71, status: "OFFLINE" },
];

export default function CoachesPage() {
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
        <h1 className="text-2xl font-semibold text-neutral-900">Тренеры</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Профили, нагрузка, KPI и аналитика эффективности.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Всего тренеров" value="842" icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Онлайн" value="38" subtitle="LIVE" icon={<Wifi className="h-5 w-5" />} />
        <MetricCard label="Средний KPI" value="84.2" subtitle="+1.2" icon={<BarChart3 className="h-5 w-5" />} />
        <MetricCard label="Сертификация" value="12 ждут" icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-3">
          <p className="text-sm font-medium text-neutral-700">Список тренеров</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-500">
              <th className="px-5 py-3">ФИО</th>
              <th className="px-5 py-3">Регион</th>
              <th className="px-5 py-3">Группы</th>
              <th className="px-5 py-3">Спортсмены</th>
              <th className="px-5 py-3">KPI</th>
              <th className="px-5 py-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((c) => (
              <tr key={c.name} className="border-b border-neutral-50 text-sm text-neutral-700 hover:bg-neutral-50">
                <td className="px-5 py-3 font-medium text-neutral-900">{c.name}</td>
                <td className="px-5 py-3">{c.region}</td>
                <td className="px-5 py-3">{c.groups}</td>
                <td className="px-5 py-3">{c.athletes}</td>
                <td className="px-5 py-3">{c.kpi}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status === "ONLINE"
                        ? "bg-green-50 text-green-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        c.status === "ONLINE" ? "bg-green-500" : "bg-neutral-400"
                      }`}
                    />
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
