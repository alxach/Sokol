import { cn } from "@/lib/utils";

const variants = {
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-brand-blue/10 text-brand-blue",
  neutral: "bg-neutral-100 text-neutral-700",
} as const;

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: keyof typeof variants;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variants[variant],
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
    ACTIVE: "success",
    ONLINE: "success",
    submitted: "success",
    VACATION: "warning",
    INJURY: "danger",
    OFFLINE: "neutral",
    draft: "warning",
    missing: "danger",
  };

  return <Badge variant={variants[status] ?? "neutral"}>{status}</Badge>;
}
