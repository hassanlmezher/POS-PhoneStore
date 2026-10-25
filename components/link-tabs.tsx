"use client";

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

/**
 * URL-driven filter tabs (pill style, same look as Segmented). Scrolls sideways on phones: the active
 * tab is scrolled into view and the edge fades where more tabs are hidden.
 */
export function LinkTabs({ items, label, className }: { items: LinkTab[]; label: string; className?: string }) {
  const ref = React.useRef<HTMLElement>(null);
  const [fade, setFade] = React.useState({ start: false, end: false });

  React.useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    nav.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const update = () => {
      // scrollLeft is negative in right-to-left layouts; work with the distance from the start.
      const from = Math.abs(nav.scrollLeft);
      const room = nav.scrollWidth - nav.clientWidth;
      setFade({ start: from > 2, end: room - from > 2 });
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  const mask =
    fade.start || fade.end
      ? `linear-gradient(to var(--tabs-end), ${fade.start ? "transparent, black 24px" : "black"}, ${fade.end ? "black calc(100% - 24px), transparent" : "black"})`
      : undefined;

  return (
    <nav
      ref={ref}
      aria-label={label}
      className={cn("-mx-1 overflow-x-auto px-1 [--tabs-end:right] [scrollbar-width:none] rtl:[--tabs-end:left]", className)}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      <ul className="inline-flex h-11 min-w-max rounded-lg border bg-muted/60 p-1">
        {items.map((it) => (
          <li key={it.href} className="flex">
            <Link
              href={it.href}
              aria-current={it.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors lg:px-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
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
