import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Usually a single primary Button. */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-1 flex size-12 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-card">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {body && <p className="text-sm text-muted-foreground">{body}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
