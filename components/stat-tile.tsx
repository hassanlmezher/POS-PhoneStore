import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatTileProps = {
  icon: LucideIcon;
  label: React.ReactNode;
  children: React.ReactNode;
  /** Tints the icon: default (primary), warning, success. */
  tone?: "default" | "warning" | "success";
  className?: string;
};

const tones = {
  default: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
};

/** Compact KPI tile: label, big value, icon. */
export function StatTile({ icon: Icon, label, children, tone = "default", className }: StatTileProps) {
  return (
    <div className={cn("flex min-w-0 items-start justify-between gap-2 rounded-xl border bg-card p-3.5 shadow-card sm:gap-3 sm:p-5", className)}>
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{children}</div>
      </div>
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-10", tones[tone])}>
        <Icon className="size-4 sm:size-5" aria-hidden />
      </div>
    </div>
  );
}
