import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg border border-border bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
