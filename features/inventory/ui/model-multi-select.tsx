"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchDeviceModels } from "@/features/inventory/actions";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

export type ModelOption = { id: string; name: string; brand: { name: string } };

type Props = { id: string; value: ModelOption[]; onChange: (v: ModelOption[]) => void };

/** Chips + typeahead for "compatible models" (parts). */
export function ModelMultiSelect({ id, value, onChange }: Props) {
  const t = useTranslations("inventory");
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ q: string; rows: ModelOption[] }>({ q: "", rows: [] });
  const debounced = useDebounced(q.trim(), 200);

  useEffect(() => {
    if (debounced.length < 1) return;
    let stale = false;
    searchDeviceModels(debounced)
      .then((rows) => {
        if (stale) return;
        setResult({ q: debounced, rows });
        setActive(0);
      })
      .catch(() => {
        if (!stale) setResult({ q: debounced, rows: [] });
      });
    return () => {
      stale = true;
    };
  }, [debounced]);

  const chosen = new Set(value.map((m) => m.id));
  const fresh = debounced.length > 0 && result.q === debounced;
  const options = fresh ? result.rows.filter((m) => !chosen.has(m.id)) : [];
  const loading = debounced.length > 0 && !fresh;

  function add(m: ModelOption) {
    onChange([...value, m]);
    setQ("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      // Never submit the form from here.
      e.preventDefault();
      if (options[active]) add(options[active]);
    } else if (e.key === "Backspace" && !q && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("compatibleModels")}>
          {value.map((m) => (
            <li key={m.id} className="inline-flex h-8 items-center gap-1 rounded-md border bg-secondary ps-2.5 text-sm">
              {m.brand.name} {m.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== m.id))}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                aria-label={t("removeModel", { name: `${m.brand.name} ${m.name}` })}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        {loading ? (
          <Loader2 aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle-foreground" />
        ) : (
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
        )}
        <Input
          id={id}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className="ps-9"
          placeholder={t("modelPlaceholder")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {open && options.length > 0 && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-pop">
            {options.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(m)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm", i === active && "bg-accent")}
              >
                <span className="text-muted-foreground">{m.brand.name}</span>
                <span className="font-medium">{m.name}</span>
              </li>
            ))}
          </ul>
        )}
        {open && fresh && options.length === 0 && (
          <p className="absolute inset-x-0 top-full z-20 mt-1.5 rounded-xl border bg-popover px-3 py-3 text-sm text-muted-foreground shadow-pop">
            {t("noModels")}
          </p>
        )}
      </div>
    </div>
  );
}
