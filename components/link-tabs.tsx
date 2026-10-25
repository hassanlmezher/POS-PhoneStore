import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type LinkTab = {
  href: string;
  label: React.ReactNode;
  active: boolean;
  /** Small counter pill after the label. */
  count?: number;
  /** `warning` tints the counter (e.g. low stock). */
  tone?: "default" | "warning";
};

/** URL-driven filter tabs (pill style, same look as Segmented). Scrolls sideways on phones. */
export function LinkTabs({ items, label, className }: { items: LinkTab[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-1 overflow-x-auto px-1", className)}>
      <ul className="inline-flex h-11 min-w-max rounded-lg border bg-muted/60 p-1">
        {items.map((it) => (
          <li key={it.href} className="flex">
            <Link
              href={it.href}
              aria-current={it.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                it.active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {it.label}
              {it.count !== undefined && it.count > 0 && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-xs leading-5 tabular-nums",
                    it.tone === "warning" ? "bg-warning-soft text-warning" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {it.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
