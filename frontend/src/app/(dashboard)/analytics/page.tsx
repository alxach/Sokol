"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const athleteGrowth = [
  { month: "Янв", value: 3200 }, { month: "Фев", value: 3800 },
  { month: "Мар", value: 4500 }, { month: "Апр", value: 5200 },
  { month: "Май", value: 6100 }, { month: "Июн", value: 7200 },
  { month: "Июл", value: 8100 }, { month: "Авг", value: 8900 },
  { month: "Сен", value: 9800 }, { month: "Окт", value: 10700 },
  { month: "Ноя", value: 11800 }, { month: "Дек", value: 12482 },
];

const regionEfficiency = [
  { name: "Москва", efficiency: 94, athletes: 3200 },
  { name: "СПб", efficiency: 87, athletes: 2100 },
  { name: "Казань", efficiency: 82, athletes: 1500 },
  { name: "Екб", efficiency: 76, athletes: 980 },
  { name: "Новосиб.", efficiency: 71, athletes: 720 },
  { name: "Омск", efficiency: 65, athletes: 450 },
];

const quarterlyTrends = [
  { quarter: "Q1", attendance: 78, athletes: 3200, efficiency: 72 },
  { quarter: "Q2", attendance: 82, athletes: 3800, efficiency: 76 },
  { quarter: "Q3", attendance: 88, athletes: 4500, efficiency: 81 },
  { quarter: "Q4", attendance: 91, athletes: 5200, efficiency: 86 },
  { quarter: "Q5", attendance: 89, athletes: 6100, efficiency: 84 },
  { quarter: "Q6", attendance: 93, athletes: 7200, efficiency: 88 },
  { quarter: "Q7", attendance: 92, athletes: 8100, efficiency: 87 },
  { quarter: "Q8", attendance: 95, athletes: 9800, efficiency: 90 },
];

export default function AnalyticsPage() {
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
        <h1 className="text-2xl font-semibold text-brand-navy">Аналитика</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Региональные сравнения, тренды, эффективность тренеров и рост спортсменов.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <p className="text-sm text-neutral-500">Рост за год</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">
            +18.4<span className="text-base">%</span>
          </p>
          <p className="text-xs text-neutral-400 mt-1">vs прошлый</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <p className="text-sm text-neutral-500">Eff. score</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">86.2</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <p className="text-sm text-neutral-500">Регионы &gt; target</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">
            4 <span className="text-base text-neutral-400">/ 6</span>
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <p className="text-sm text-neutral-500">Топ-регион</p>
          <p className="text-lg font-semibold text-neutral-900 mt-1">Москва</p>
          <p className="text-xs text-green-600 mt-1">94% efficiency</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">
            Рост числа спортсменов — 12 месяцев
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={athleteGrowth}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#467FC0" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#467FC0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#467FC0" fill="url(#colorValue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">
            Эффективность регионов
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={regionEfficiency} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
              <Tooltip formatter={(value) => [`${value}%`, "Эффективность"]} />
              <Bar dataKey="efficiency" fill="#467FC0" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">
            Сравнение трендов — поквартально
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={quarterlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="attendance" stroke="#467FC0" strokeWidth={2} dot={false} name="Посещаемость" />
              <Line type="monotone" dataKey="efficiency" stroke="#09234C" strokeWidth={2} dot={false} name="Эффективность" />
              <Line type="monotone" dataKey="athletes" stroke="#F4A838" strokeWidth={2} dot={false} name="Спортсмены" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
