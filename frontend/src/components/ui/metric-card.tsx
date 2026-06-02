import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export function MetricCard({ label, value, subtitle, icon, trend, trendUp }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="text-2xl font-semibold text-neutral-900">{value}</p>
          {subtitle ? <p className="text-xs text-neutral-400">{subtitle}</p> : null}
        </div>
        {icon ? <div className="text-neutral-400">{icon}</div> : null}
      </div>
      {trend ? (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={cn("text-xs font-medium", trendUp ? "text-green-600" : "text-red-600")}>
            {trend}
          </span>
        </div>
      ) : null}
    </div>
  );
}
