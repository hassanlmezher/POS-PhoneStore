"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Package, Search, UserRound, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Kbd } from "@/components/ui/kbd";
import { globalSearch, type GlobalSearchResult } from "@/features/search/actions";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { useShopCountryCode } from "@/components/shop-context";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

type Item =
  | { kind: "customer"; key: string; href: string; c: GlobalSearchResult["customers"][number] }
  | { kind: "ticket"; key: string; href: string; t: GlobalSearchResult["tickets"][number] }
  | { kind: "product"; key: string; href: string; p: GlobalSearchResult["products"][number] };

// Same rule as parseTicketNumber (lib/numbering is server-only).
const ticketNumberOf = (q: string) => {
  const m = q.trim().match(/^(?:[a-z]+-?)?(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
};

/** Top-bar search: phone, ticket #, IMEI, name, product. Grouped results with keyboard navigation. */
export function GlobalSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const countryCode = useShopCountryCode();
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ q: string; data: GlobalSearchResult | null; error?: boolean }>({ q: "", data: null });
  const debounced = useDebounced(q.trim(), 200);
  const ready = debounced.length >= 2;

  useEffect(() => {
    if (debounced.length < 2) return;
    let stale = false;
    globalSearch(debounced)
      .then((data) => {
        if (stale) return;
        setResult({ q: debounced, data });
        setActive(0);
      })
      .catch(() => {
        if (!stale) setResult({ q: debounced, data: null, error: true });
      });
    return () => {
      stale = true;
    };
  }, [debounced]);

  const fresh = ready && result.q === debounced;
  const loading = ready && !fresh;
  const data = fresh ? result.data : null;
  const items: Item[] = data
    ? [
        ...data.customers.map((c) => ({ kind: "customer" as const, key: `c-${c.id}`, href: `/customers/${c.id}`, c })),
        ...data.tickets.map((tk) => ({ kind: "ticket" as const, key: `t-${tk.number}`, href: `/tickets/${tk.number}`, t: tk })),
        ...data.products.map((p) => ({ kind: "product" as const, key: `p-${p.id}`, href: `/inventory/${p.id}`, p })),
      ]
    : [];
  const selectable = items.map((it, i) => (it.href ? i : -1)).filter((i) => i >= 0);
  const showPanel = open && ready;

  function go(href: string) {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open && q) setOpen(false);
      else e.currentTarget.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!selectable.length) return;
      const pos = selectable.indexOf(active);
      const next = e.key === "ArrowDown" ? (pos + 1) % selectable.length : (pos - 1 + selectable.length) % selectable.length;
      setActive(selectable[pos === -1 ? 0 : next]);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = ticketNumberOf(q);
    // Exact ticket number → straight to the ticket, even before results arrive.
    if (n !== null && (data?.tickets.some((tk) => tk.number === n) || /^[a-z]+-?\d+$/i.test(q.trim()))) {
      return go(`/tickets/${n}`);
    }
    const it = items[active];
    if (it?.href) go(it.href);
    else if (selectable.length) go(items[selectable[0]].href!);
  }

  const groups: { kind: Item["kind"]; label: string; icon: typeof UserRound; from: number; to: number }[] = [];
  for (const [kind, label, icon] of [
    ["customer", t("customers"), UserRound],
    ["ticket", t("repairs"), Wrench],
    ["product", t("products"), Package],
  ] as const) {
    const idx = items.map((it, i) => (it.kind === kind ? i : -1)).filter((i) => i >= 0);
    if (idx.length) groups.push({ kind, label, icon, from: idx[0], to: idx[idx.length - 1] });
  }

  return (
    <form role="search" className="relative min-w-0 flex-1 md:max-w-md" onSubmit={onSubmit}>
      <label htmlFor="global-search" className="sr-only">
        {tc("search")}
      </label>
      {loading ? (
        <Loader2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle-foreground" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
      )}
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && items[active]?.href ? `${listId}-${active}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={tc("searchPlaceholder")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-lg border bg-card ps-9 pe-3 text-base shadow-card outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 md:pe-10 md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      <Kbd className="absolute end-3 top-1/2 hidden -translate-y-1/2 md:inline-flex">/</Kbd>

      {showPanel && (
        <div className="absolute start-0 top-full z-40 mt-2 max-h-[70svh] w-full min-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-pop max-md:fixed max-md:inset-x-3 max-md:top-16 max-md:w-auto max-md:min-w-0">
          {loading && !items.length && <p className="px-3 py-4 text-sm text-muted-foreground">{t("searching")}</p>}
          {fresh && result.error && <p className="px-3 py-4 text-sm text-destructive">{t("error")}</p>}
          {fresh && !result.error && !items.length && (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t("noResults", { q: debounced })}</p>
          )}
          <ul id={listId} role="listbox" aria-label={tc("search")}>
            {groups.map((g) => (
              <li key={g.kind} role="presentation" className="py-1">
                <p className="flex items-center gap-2 px-3 pt-1 pb-1.5 text-xs font-medium text-muted-foreground" aria-hidden>
                  <g.icon className="size-3.5" />
                  {g.label}
                </p>
                <ul role="group" aria-label={g.label}>
                  {items.slice(g.from, g.to + 1).map((it, j) => {
                    const i = g.from + j;
                    const disabled = !it.href;
                    return (
                      <li
                        key={it.key}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active && !disabled}
                        aria-disabled={disabled || undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => !disabled && setActive(i)}
                        onClick={() => it.href && go(it.href)}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm",
                          disabled ? "cursor-default opacity-60" : "cursor-pointer",
                          i === active && !disabled && "bg-accent",
                        )}
                      >
                        {it.kind === "customer" && (
                          <>
                            <span className="min-w-0 flex-1 truncate font-medium">{it.c.name}</span>
                            <bdi dir="ltr" className="text-muted-foreground tabular-nums">
                              {formatPhone(it.c.phone, countryCode)}
                            </bdi>
                          </>
                        )}
                        {it.kind === "ticket" && (
                          <>
                            <bdi dir="ltr" className="w-16 shrink-0 font-semibold tabular-nums">
                              {it.t.label}
                            </bdi>
                            <span className="min-w-0 flex-1 truncate">
                              {it.t.device}
                              <span className="text-muted-foreground"> · {it.t.customerName}</span>
                            </span>
                            <StatusBadge status={it.t.status} className="hidden sm:inline-flex" />
                          </>
                        )}
                        {it.kind === "product" && (
                          <>
                            <span className="min-w-0 flex-1 truncate">{it.p.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{t("stock", { count: it.p.qty })}</span>
                            <bdi dir="ltr" className="text-xs tabular-nums">
                              {formatMoney(it.p.priceUsdCents, "USD")}
                            </bdi>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {items.length > 0 && (
            <p className="hidden items-center gap-2 border-t px-3 pt-2 pb-1 text-xs text-subtle-foreground md:flex">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              {t("navigate")}
              <Kbd className="ms-2">↵</Kbd>
              {t("open")}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
