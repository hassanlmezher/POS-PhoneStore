"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PatternGridProps = {
  /** Put on the dot group so a form can focus it after a validation error. */
  id?: string;
  /** Dot sequence like "1-5-9-6" (1 = top-left, 9 = bottom-right). */
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  size?: "md" | "sm";
};

const DOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function center(dot: number, cell: number) {
  const i = dot - 1;
  return { x: (i % 3) * cell + cell / 2, y: Math.floor(i / 3) * cell + cell / 2 };
}

/**
 * 3×3 Android pattern lock. Tap dots in order to build the pattern; read-only mode draws it with step numbers.
 * Layout is always LTR so "1 = top-left" holds in Arabic too.
 */
export function PatternGrid({ id, value, onChange, readOnly, className, size = "md" }: PatternGridProps) {
  const t = useTranslations("pattern");
  const seq = value ? value.split("-").map(Number).filter((n) => n >= 1 && n <= 9) : [];
  const cell = size === "md" ? 56 : 40;
  const total = cell * 3;

  function tap(dot: number) {
    if (readOnly || !onChange) return;
    if (seq.includes(dot)) return;
    onChange([...seq, dot].join("-"));
  }

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <div dir="ltr" className="relative rounded-xl border bg-muted/40 p-2" style={{ width: total + 16, height: total + 16 }}>
        <svg aria-hidden width={total} height={total} className="pointer-events-none absolute start-2 top-2 text-primary">
          {seq.slice(1).map((dot, i) => {
            const a = center(seq[i], cell);
            const b = center(dot, cell);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth={4} strokeLinecap="round" opacity={0.5} />;
          })}
        </svg>
        <div id={id} tabIndex={id ? -1 : undefined} role="group" aria-label={t("label")} className="relative grid grid-cols-3 outline-none" style={{ width: total, height: total }}>
          {DOTS.map((dot) => {
            const step = seq.indexOf(dot);
            const active = step >= 0;
            const Comp = readOnly ? "span" : "button";
            return (
              <Comp
                key={dot}
                {...(!readOnly && { type: "button" as const, onClick: () => tap(dot), "aria-pressed": active })}
                aria-label={t("dot", { n: dot })}
                className={cn(
                  "flex items-center justify-center rounded-full outline-none",
                  !readOnly && "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                    size === "md" ? "size-7" : "size-6",
                    active ? "bg-primary text-primary-foreground" : "bg-card text-transparent ring-1 ring-border",
                  )}
                >
                  {active ? step + 1 : ""}
                </span>
              </Comp>
            );
          })}
        </div>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span dir="ltr" className="tabular-nums">{value || t("empty")}</span>
          {seq.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange?.("")}>
              <RotateCcw />
              {t("clear")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
