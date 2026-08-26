import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";

const tones = {
  primary: "border-l-primary",
  secondary: "border-l-secondary",
  accent: "border-l-accent",
  success: "border-l-[color:var(--success)]",
} as const;

export function MiniStat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: keyof typeof tones;
  icon?: ReactNode;
}) {
  return (
    <Card className={`flex items-center justify-between border-l-4 p-5 shadow-[var(--shadow-card)] ${tones[accent]}`}>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-2xl font-bold text-secondary">{value}</div>
      </div>
      {icon && <div className="text-accent">{icon}</div>}
    </Card>
  );
}
