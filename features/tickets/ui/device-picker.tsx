"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, PenLine, Smartphone, X } from "lucide-react";
import { Field, fieldAria } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CatalogBrand = { id: string; name: string; models: { id: string; name: string }[] };
export type DeviceValue =
  | { kind: "model"; id: string; label: string }
  | { kind: "other"; brandText: string; modelText: string }
  | null;

type Entry = { id: string; label: string; brand: string; model: string; hay: string; hayTight: string };

const norm = (s: string) => s.toLowerCase().normalize("NFKD");

/** "a54", "samsung a54", "iphone13pro" → matching catalog models. Every typed word must match. */
export function matchDevices(entries: Entry[], q: string, limit = 8): Entry[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { e: Entry; score: number }[] = [];
  for (const e of entries) {
    if (!words.every((w) => e.hay.includes(w) || e.hayTight.includes(w))) continue;
    const m = norm(e.model);
    // Model-name prefix hits first, then shorter names (A54 before A54 5G).
    const score = (m.startsWith(words[words.length - 1]) || m.split(" ").some((p) => p.startsWith(words[0])) ? 0 : 10) + e.label.length / 100;
    scored.push({ e, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.e);
}

type DevicePickerProps = {
  catalog: CatalogBrand[];
  value: DeviceValue;
  onChange: (v: DeviceValue) => void;
  error?: string;
  autoFocus?: boolean;
};

/** Single searchable combobox over the device catalog, with an "Other" escape hatch (brand + model text). */
export function DevicePicker({ catalog, value, onChange, error, autoFocus }: DevicePickerProps) {
  const t = useTranslations("intake");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const entries = useMemo<Entry[]>(
    () =>
      catalog.flatMap((b) =>
        b.models.map((m) => {
          const label = `${b.name} ${m.name}`;
          return { id: m.id, label, brand: b.name, model: m.name, hay: norm(label), hayTight: norm(label).replace(/\s+/g, "") };
        }),
      ),
    [catalog],
  );
  const results = useMemo(() => matchDevices(entries, query), [entries, query]);
  const options = query.trim() ? results.length + 1 : 0; // +1 = "Other"

  function pick(i: number) {
    if (i < results.length) onChange({ kind: "model", id: results[i].id, label: results[i].label });
    else {
      const words = query.trim().split(/\s+/);
      const brand = catalog.find((b) => norm(b.name) === norm(words[0] ?? ""));
      onChange({ kind: "other", brandText: brand ? brand.name : "", modelText: brand ? words.slice(1).join(" ") : query.trim() });
    }
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!options) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + options) % options);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") setOpen(false);
  }

  if (value?.kind === "model") {
    return (
      <Field label={t("device")} htmlFor="intake-device-picked">
        <div id="intake-device-picked" className="flex h-11 items-center gap-3 rounded-lg border bg-primary-soft/50 ps-3 pe-1">
          <Smartphone className="size-4 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{value.label}</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("changeDevice")} onClick={() => onChange(null)}>
            <X />
          </Button>
        </div>
      </Field>
    );
  }

  if (value?.kind === "other") {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("brand")} htmlFor="intake-brand" optional>
            <Input
              id="intake-brand"
              autoComplete="off"
              list="intake-brands"
              value={value.brandText}
              onChange={(e) => onChange({ ...value, brandText: e.target.value })}
            />
            <datalist id="intake-brands">
              {catalog.map((b) => (
                <option key={b.id} value={b.name} />
              ))}
            </datalist>
          </Field>
          <Field label={t("model")} htmlFor="intake-model" error={error}>
            <Input
              {...fieldAria("intake-model", error)}
              autoFocus
              autoComplete="off"
              value={value.modelText}
              onChange={(e) => onChange({ ...value, modelText: e.target.value })}
            />
          </Field>
        </div>
        <Button type="button" variant="link" className="h-auto self-start p-0" onClick={() => onChange(null)}>
          {t("backToList")}
        </Button>
      </div>
    );
  }

  return (
    <Field label={t("device")} htmlFor="intake-device" error={error}>
      <div className="relative">
        <Smartphone aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
        <Input
          {...fieldAria("intake-device", error)}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open && options > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="next"
          placeholder={t("devicePlaceholder")}
          className="ps-9"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open && options > 0 && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-pop">
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm", i === active && "bg-accent")}
              >
                <span className="text-muted-foreground">{r.brand}</span>
                <span className="font-medium">{r.model}</span>
                {i === active && <Check aria-hidden className="ms-auto size-4 text-primary" />}
              </li>
            ))}
            <li
              id={`${listId}-${results.length}`}
              role="option"
              aria-selected={active === results.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(results.length)}
              onMouseEnter={() => setActive(results.length)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground",
                results.length > 0 && "mt-1 border-t pt-1",
                active === results.length && "bg-accent text-foreground",
              )}
            >
              <PenLine aria-hidden className="size-4" />
              {t("otherDevice", { q: query.trim() })}
            </li>
          </ul>
        )}
      </div>
    </Field>
  );
}
