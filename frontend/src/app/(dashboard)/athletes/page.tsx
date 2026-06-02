"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/badge";
import { Users, Award, HeartPulse, UserPlus, Search, Download, Plus, Filter } from "lucide-react";

const athletes = [
  { initials: "ДВ", name: "Дмитрий Волков", discipline: "Борьба", weight: "75кг", age: 22, rank: "МСМК", region: "Москва", attendance: "95%", status: "ACTIVE" },
  { initials: "ЕК", name: "Елена Кузнецова", discipline: "Дзюдо", weight: "52кг", age: 19, rank: "МС", region: "СПб", attendance: "78%", status: "VACATION" },
  { initials: "СС", name: "Сергей Смирнов", discipline: "Каратэ", weight: "80кг", age: 24, rank: "КМС", region: "Казань", attendance: "92%", status: "ACTIVE" },
  { initials: "МБ", name: "Максим Белов", discipline: "Самбо", weight: "68кг", age: 21, rank: "КМС", region: "Москва", attendance: "88%", status: "ACTIVE" },
  { initials: "ИИ", name: "Игорь Иванов", discipline: "Каратэ", weight: "90кг", age: 26, rank: "МС", region: "Екб", attendance: "64%", status: "INJURY" },
  { initials: "АЗ", name: "Анна Зайцева", discipline: "Дзюдо", weight: "57кг", age: 18, rank: "I разряд", region: "Новосибирск", attendance: "81%", status: "ACTIVE" },
  { initials: "ОН", name: "Олег Никитин", discipline: "Самбо", weight: "82кг", age: 23, rank: "МС", region: "Омск", attendance: "90%", status: "ACTIVE" },
  { initials: "ЮП", name: "Юлия Петрова", discipline: "Бокс", weight: "60кг", age: 20, rank: "КМС", region: "Москва", attendance: "86%", status: "ACTIVE" },
];

const downloadExcel = async (type: string) => {
  const token = localStorage.getItem("access_token");
  if (!token) return;
  try {
    const res = await fetch(`http://localhost:8000/api/v1/exports/excel/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Ошибка экспорта");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
};

export default function AthletesPage() {
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
        <h1 className="text-2xl font-semibold text-neutral-900">Спортсмены</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Профили, разряды, возрастные и весовые категории, посещаемость и история выступлений.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
          <Filter className="h-4 w-4" />
          Фильтр
        </button>
        <button
          onClick={() => downloadExcel("athletes")}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          Экспорт
        </button>
        <button className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors ml-auto">
          <Plus className="h-4 w-4" />
          Новый профиль
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Всего" value="12,482" subtitle="+248 за месяц" icon={<Users className="h-5 w-5" />} />
        <MetricCard label="МСМК + МС" value="412" subtitle="3.3% от всех" icon={<Award className="h-5 w-5" />} />
        <MetricCard label="Травмы" value="38" subtitle="+5 за неделю" icon={<HeartPulse className="h-5 w-5" />} />
        <MetricCard label="Новые" value="248" subtitle="за 30 дней" icon={<UserPlus className="h-5 w-5" />} />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <p className="text-sm font-medium text-neutral-700">Реестр (8)</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input className="h-9 rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-500 w-64" placeholder="Поиск..." />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-500">
              <th className="px-5 py-3">ФИО</th>
              <th className="px-5 py-3">Дисциплина</th>
              <th className="px-5 py-3">Вес</th>
              <th className="px-5 py-3">Возр.</th>
              <th className="px-5 py-3">Разряд</th>
              <th className="px-5 py-3">Регион</th>
              <th className="px-5 py-3">Посещаемость</th>
              <th className="px-5 py-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((a) => (
              <tr key={a.name} className="border-b border-neutral-50 text-sm text-neutral-700 hover:bg-neutral-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-700">
                      {a.initials}
                    </div>
                    <span className="font-medium text-neutral-900">{a.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3">{a.discipline}</td>
                <td className="px-5 py-3">{a.weight}</td>
                <td className="px-5 py-3">{a.age}</td>
                <td className="px-5 py-3">{a.rank}</td>
                <td className="px-5 py-3">{a.region}</td>
                <td className="px-5 py-3">{a.attendance}</td>
                <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
