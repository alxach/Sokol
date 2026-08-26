import { Badge } from "@/components/ui/badge";

type StatusKind = "success" | "danger" | "warning" | "muted" | "primary" | "info";

const toneMap: Record<StatusKind, string> = {
  success: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-accent/20 text-accent-foreground border-accent/30",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/30",
  info: "bg-secondary/10 text-secondary border-secondary/30",
};

export function StatusBadge({
  label,
  kind,
}: {
  label: string;
  kind: StatusKind;
}) {
  return (
    <Badge variant="outline" className={`font-normal ${toneMap[kind]}`}>
      {label}
    </Badge>
  );
}
