"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchSelectOption = { value: string; label: string; hint?: string };
export type SearchSelectGroup = { label: string; options: SearchSelectOption[] };

type Props = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  groups: SearchSelectGroup[];
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Max options rendered per group while searching (keeps long lists fast). */
  limit?: number;
  className?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[_/]+/g, " ");

/**
 * Select with a search box, for long option lists (time zones, etc.). The trigger looks like
 * NativeSelect; the list opens in a popover with arrow-key navigation and Enter to pick.
 */
export function SearchSelect({
  id,
  value,
  onValueChange,
  groups,
  searchPlaceholder,
  emptyText,
  disabled,
  invalid,
  describedBy,
  limit = 200,
  className,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const current = useMemo(() => groups.flatMap((g) => g.options).find((o) => o.value === value), [groups, value]);

  const filtered = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    return groups
      .map((g) => ({
        label: g.label,
        options: g.options
          .filter((o) => {
            if (words.length && seen.has(o.value)) return false; // de-dupe "suggested" while searching
            const hay = norm(`${o.label} ${o.value} ${o.hint ?? ""}`);
            const ok = words.every((w) => hay.includes(w));
            if (ok) seen.add(o.value);
            return ok;
          })
          .slice(0, limit),
      }))
      .filter((g) => g.options.length);
  }, [groups, query, limit]);
  const flat = filtered.flatMap((g) => g.options);

  function pick(o: SearchSelectOption | undefined) {
    if (!o) return;
    onValueChange(o.value);
    setOpen(false);
    setQuery("");
  }

  function move(next: number) {
    if (!flat.length) return;
    const i = (next + flat.length) % flat.length;
    setActive(i);
    listRef.current?.querySelector(`#${CSS.escape(`${listId}-${i}`)}`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(flat[active]);
    }
  }

  const offsets = filtered.map((_, gi) => filtered.slice(0, gi).reduce((n, g) => n + g.options.length, 0));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setQuery("");
        setActive(Math.max(0, flat.findIndex((x) => x.value === value)));
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          data-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-haspopup="listbox"
          className={cn(
            "flex h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-card ps-3 pe-3 text-start text-base shadow-card transition-[color,box-shadow,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 data-invalid:border-destructive",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{current?.label ?? value}</span>
          {current?.hint && <span className="shrink-0 text-xs text-muted-foreground tabular-nums" dir="ltr">{current.hint}</span>}
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="relative border-b p-1.5">
          <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="border-0 ps-9 shadow-none focus-visible:ring-0"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>}
          {filtered.map((g, gi) => (
            <li key={g.label} role="presentation">
              <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{g.label}</div>
              <ul role="group" aria-label={g.label}>
                {g.options.map((o, oi) => {
                  const i = offsets[gi] + oi;
                  const selected = o.value === value;
                  return (
                    <li
                      key={`${g.label}-${o.value}`}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(o)}
                      onMouseEnter={() => setActive(i)}
                      className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm", i === active && "bg-accent")}
                    >
                      <span className={cn("min-w-0 flex-1 truncate", selected && "font-medium")}>{o.label}</span>
                      {o.hint && (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" dir="ltr">
                          {o.hint}
                        </span>
                      )}
                      <Check aria-hidden className={cn("size-4 shrink-0 text-primary", !selected && "invisible")} />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
