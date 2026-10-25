"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { dirOf, isLocale } from "@/i18n/config";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type BarChartItem = {
  key: string;
  /** Short x-axis label ("Oct 3", "Mon"). */
  label: string;
  /** Full label for the tooltip and screen readers ("Friday, Oct 3"). */
  title: string;
  /** One value per series, in USD cents. Stacked bottom-up in series order. */
  values: number[];
};

export type BarChartSeries = { label: string; color: "chart-1" | "chart-2" };

type BarChartProps = {
  items: BarChartItem[];
  series: BarChartSeries[];
  /** Describes the chart for screen readers. */
  label: string;
  /** Plot height in px. */
  height?: number;
  className?: string;
};

const fill = { "chart-1": "fill-chart-1", "chart-2": "fill-chart-2" } as const;
const swatch = { "chart-1": "bg-chart-1", "chart-2": "bg-chart-2" } as const;

/** Round up to 1, 2, 2.5 or 5 × 10ⁿ so gridlines land on readable values. */
function niceMax(v: number): number {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const axisMoney = (cents: number) => `$${compact.format(cents / 100)}`;

/**
 * Small dependency-free stacked bar chart (USD cents). Bars are SVG; axis labels and hover
 * targets are HTML so they follow the page direction (first item sits at the start side in RTL).
 */
export function BarChart({ items, series, label, height = 200, className }: BarChartProps) {
  const locale = useLocale();
  const rtl = isLocale(locale) && dirOf(locale) === "rtl";
  const [active, setActive] = React.useState<number | null>(null);
  const n = Math.max(1, items.length);
  const totals = items.map((it) => it.values.reduce((s, v) => s + Math.max(0, v), 0));
  const max = niceMax(Math.max(0, ...totals));
  const gap = n > 20 ? 0.25 : 0.35;
  const step = n <= 10 ? 1 : n <= 20 ? 2 : Math.ceil(n / 8);
  // Tooltip anchor: centred on the bar, but pinned to the start/end near the edges so it never overflows.
  const tipAt = active === null ? 0 : (active + 0.5) / n;
  const tipAlign = tipAt < 0.25 ? "start" : tipAt > 0.75 ? "end" : "center";
  const describe = (it: BarChartItem) =>
    `${it.title}: ${series.map((s, j) => `${s.label} ${formatMoney(it.values[j] ?? 0, "USD")}`).join(", ")}`;

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="flex gap-2">
        {/* Y axis */}
        <div aria-hidden className="flex w-10 shrink-0 flex-col justify-between text-end text-[11px] leading-none text-subtle-foreground" style={{ height }}>
          <span dir="ltr">{axisMoney(max)}</span>
          <span dir="ltr">{axisMoney(max / 2)}</span>
          <span dir="ltr">$0</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            <svg aria-hidden className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none">
              {[0, 50, 100].map((y) => (
                <line
                  key={y}
                  x1={0}
                  x2={n}
                  y1={y}
                  y2={y}
                  vectorEffect="non-scaling-stroke"
                  className={y === 100 ? "stroke-border" : "stroke-border/70"}
                  strokeDasharray={y === 100 ? undefined : "3 3"}
                />
              ))}
              {items.map((it, i) => {
                const x = (rtl ? n - 1 - i : i) + gap / 2;
                let base = 100;
                return (
                  <g key={it.key} className={cn("transition-opacity", active !== null && active !== i && "opacity-40")}>
                    {it.values.map((v, j) => {
                      if (v <= 0) return null;
                      const h = Math.max(0.8, (v / max) * 100);
                      base -= h;
                      return <rect key={j} x={x} y={base} width={1 - gap} height={h} className={fill[series[j]?.color ?? "chart-1"]} />;
                    })}
                  </g>
                );
              })}
            </svg>

            {/* Hover targets (mouse); keyboard and screen-reader users get the list below and the data table. */}
            <div aria-hidden className="absolute inset-0 flex" onMouseLeave={() => setActive(null)}>
              {items.map((it, i) => (
                <div key={it.key} className="h-full flex-1" onMouseEnter={() => setActive(i)} onTouchStart={() => setActive(i)} />
              ))}
            </div>

            {active !== null && items[active] && (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-0 z-10 w-max max-w-60 rounded-lg border bg-popover px-3 py-2 text-xs shadow-pop",
                  tipAlign === "center" && "-translate-x-1/2 rtl:translate-x-1/2",
                  tipAlign === "start" && "ms-3",
                  tipAlign === "end" && "me-3",
                )}
                style={tipAlign === "end" ? { insetInlineEnd: `${(1 - tipAt) * 100}%` } : { insetInlineStart: `${tipAt * 100}%` }}
              >
                <p className="mb-1 font-medium text-foreground">{items[active].title}</p>
                {series.map((s, j) => (
                  <p key={s.label} className="flex items-center gap-2 text-muted-foreground">
                    <span className={cn("size-2 rounded-sm", swatch[s.color])} />
                    {s.label}
                    <span dir="ltr" className="ms-auto ps-3 font-medium text-foreground tabular-nums">
                      {formatMoney(items[active].values[j] ?? 0, "USD")}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* X axis */}
          <div aria-hidden className="mt-2 flex h-3 text-[11px] leading-none text-subtle-foreground">
            {items.map((it, i) => (
              <span key={it.key} className="relative flex-1 text-center">
                {i % step === 0 && <span className="absolute start-1/2 -translate-x-1/2 whitespace-nowrap rtl:translate-x-1/2">{it.label}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {series.length > 1 && (
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2.5 rounded-sm", swatch[s.color])} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}

      <ul className="sr-only" aria-label={label}>
        {items.map((it) => (
          <li key={it.key}>{describe(it)}</li>
        ))}
      </ul>
    </figure>
  );
}
