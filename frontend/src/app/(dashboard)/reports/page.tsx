"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, FileImage, Bot, Sparkles, AlertTriangle, Save, ChevronDown } from "lucide-react";

const reports = [
  { region: "Москва", athletes: 842, attendance: "94%", events: 18, status: "submitted" },
  { region: "СПб", athletes: 612, attendance: "91%", events: 14, status: "submitted" },
  { region: "Казань", athletes: 429, attendance: "89%", events: 9, status: "draft" },
  { region: "Екатеринбург", athletes: 310, attendance: "87%", events: 7, status: "draft" },
  { region: "Новосибирск", athletes: 268, attendance: "88%", events: 6, status: "missing" },
  { region: "Омск", athletes: 198, attendance: "78%", events: 4, status: "missing" },
];

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const downloadExcel = async (type: string) => {
    setExportOpen(false);
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
        <h1 className="text-2xl font-semibold text-neutral-900">Отчёты — главный модуль</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Недельные и месячные отчёты, авто-черновики, экспорт и AI-сводки.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {exportOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                {[
                  { type: "athletes", label: "Спортсмены" },
                  { type: "coaches", label: "Тренеры" },
                  { type: "attendance", label: "Посещаемость" },
                  { type: "events", label: "События" },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => downloadExcel(item.type)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
          <FileText className="h-4 w-4" />
          PDF
        </button>
        <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
          <FileImage className="h-4 w-4" />
          DOCX
        </button>
        <button className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors">
          <Bot className="h-4 w-4" />
          AI-сводка
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">Сдано на этой неделе</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">94.2%</p>
          <p className="text-xs text-neutral-400 mt-1">+2.1%</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">Черновики</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">12</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">Отсутствуют</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">3</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-neutral-500">AI summary</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">Готово</p>
          <p className="text-xs text-amber-600 mt-1">2 аномалии</p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-3">
          <p className="text-sm font-medium text-neutral-700">Недельный сводный отчёт — регионы</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-500">
              <th className="px-5 py-3">Регион</th>
              <th className="px-5 py-3">Спортсмены</th>
              <th className="px-5 py-3">Посещ. %</th>
              <th className="px-5 py-3">События</th>
              <th className="px-5 py-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.region} className="border-b border-neutral-50 text-sm text-neutral-700 hover:bg-neutral-50">
                <td className="px-5 py-3 font-medium text-neutral-900">{r.region}</td>
                <td className="px-5 py-3">{r.athletes}</td>
                <td className="px-5 py-3">{r.attendance}</td>
                <td className="px-5 py-3">{r.events}</td>
                <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-neutral-900">AI-сводка</h3>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Эффективность федерации выросла на <strong>12%</strong> за квартал. Москва и СПб удерживают
            лидерство, Казань растёт по дзюдо (+18%).
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Аномалия — Омск</h3>
          </div>
          <p className="text-sm text-amber-700">
            Посещаемость упала на 9.4%. Рекомендовано проверить отчёты тренеров.
          </p>
        </div>
      </div>

      <button className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors">
        <Save className="h-4 w-4" />
        Сохранить черновик
      </button>
    </div>
  );
}
