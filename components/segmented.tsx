"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: React.ReactNode };

type SegmentedProps<T extends string> = {
  value: T;
  onValueChange: (v: T) => void;
  options: readonly Option<T>[];
  label: string;
  className?: string;
  id?: string;
};

/** Small radio-group of pill buttons (language, currency, part/labor…). Arrow keys move the selection. */
export function Segmented<T extends string>({ value, onValueChange, options, label, className, id }: SegmentedProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key !== fwd && e.key !== back) return;
    e.preventDefault();
    const next = (i + (e.key === fwd ? 1 : -1) + options.length) % options.length;
    onValueChange(options[next].value);
    refs.current[next]?.focus();
  }
  return (
    <div id={id} role="radiogroup" aria-label={label} className={cn("inline-flex h-11 rounded-lg border bg-muted/60 p-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex-1 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
              active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
