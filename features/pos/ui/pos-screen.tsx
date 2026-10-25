"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Package, ScanBarcode, Search, ShoppingCart, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { StatusBadge, type TicketStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { checkout, searchPos, type PosSearchResult } from "@/features/pos/actions";
import { formatMoney, type Currency } from "@/lib/money";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";
import { cartTotals, centsToText, newKey, type CartLine, type PaymentRow, type TicketLine } from "./cart";
import { CartLineRow } from "./cart-line";
import { DoneDialog, type DoneInfo } from "./done-dialog";
import { PaymentRows } from "./payment-rows";
import { PosCustomerPicker, type PosCustomer } from "./pos-customer";

type SearchProduct = PosSearchResult["products"][number];
type SearchTicket = PosSearchResult["tickets"][number];

type Props = {
  rate: number;
  rounding: number;
  readOnly: boolean;
  /** From ?ticket=<number>: preloaded as a balance line. */
  preloadTicket: SearchTicket | null;
};

function ticketLine(tk: SearchTicket): TicketLine {
  return {
    key: `ticket-${tk.id}`, // stable across server/client render (no hydration mismatch)
    kind: "TICKET_BALANCE",
    ticketId: tk.id,
    label: tk.label,
    device: tk.device,
    status: tk.status,
    balanceUsdCents: tk.balanceUsdCents,
    amount: centsToText(tk.balanceUsdCents),
    markPickedUp: tk.status === "READY",
  };
}

export function PosScreen({ rate, rounding, readOnly, preloadTicket }: Props) {
  const t = useTranslations("pos");
  const tt = useTranslations("search");
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ---- Cart state ----
  const [lines, setLines] = useState<CartLine[]>(() => (preloadTicket ? [ticketLine(preloadTicket)] : []));
  const [customer, setCustomer] = useState<PosCustomer | null>(() => preloadTicket?.customer ?? null);
  const [cartDiscount, setCartDiscount] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [changeCurrency, setChangeCurrency] = useState<Currency>("USD");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);

  const totals = cartTotals(lines, cartDiscount, payments, changeCurrency, rate, rounding);
  const itemCount = lines.reduce((s, l) => s + (l.kind === "PRODUCT" ? l.qty : 1), 0);
  const needsCustomer = lines.length > 0 && totals.remaining > 0 && !customer;

  // ---- Search ----
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ q: string; data: PosSearchResult | null; error?: boolean }>({ q: "", data: null });
  const debounced = useDebounced(q.trim(), 180);
  const scanning = useRef(false);

  useEffect(() => {
    if (!debounced) return;
    let stale = false;
    searchPos(debounced)
      .then((data) => {
        if (stale || scanning.current) return;
        setResult({ q: debounced, data });
        setActive(0);
      })
      .catch(() => !stale && setResult({ q: debounced, data: null, error: true }));
    return () => {
      stale = true;
    };
  }, [debounced]);

  const fresh = !!debounced && result.q === debounced;
  const data = fresh ? result.data : null;
  const results: ({ kind: "product"; p: SearchProduct } | { kind: "ticket"; tk: SearchTicket })[] = data
    ? [...data.products.map((p) => ({ kind: "product" as const, p })), ...data.tickets.map((tk) => ({ kind: "ticket" as const, tk }))]
    : [];

  const focusSearch = useCallback(() => requestAnimationFrame(() => searchRef.current?.focus()), []);

  function addProduct(p: SearchProduct) {
    setError(null);
    setLines((ls) => {
      const existing = ls.find((l) => l.kind === "PRODUCT" && l.productId === p.id);
      if (existing) return ls.map((l) => (l === existing && l.kind === "PRODUCT" ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...ls,
        { key: newKey(), kind: "PRODUCT", productId: p.id, name: p.name, sku: p.sku, unitPriceUsdCents: p.priceUsdCents, stock: p.qty, qty: 1, discount: "" },
      ];
    });
    if (p.qty <= 0) toast.warning(t("outOfStockAdded", { name: p.name }));
    clearSearch();
  }

  function addTicket(tk: SearchTicket) {
    setError(null);
    if (lines.some((l) => l.kind === "TICKET_BALANCE" && l.ticketId === tk.id)) {
      toast.info(t("ticketAlreadyInCart", { label: tk.label }));
    } else {
      setLines((ls) => [...ls, ticketLine(tk)]);
      if (!customer) setCustomer(tk.customer);
    }
    clearSearch();
  }

  function clearSearch() {
    setQ("");
    setResult({ q: "", data: null });
    focusSearch();
  }

  async function onSearchEnter() {
    const term = q.trim();
    if (!term) return;
    // Scanners type fast and press Enter: resolve now instead of waiting for the debounce.
    let res = fresh && result.q === term ? result.data : null;
    if (!res) {
      scanning.current = true;
      try {
        res = await searchPos(term);
      } catch {
        toast.error(tt("error"));
        return;
      } finally {
        scanning.current = false;
      }
      setResult({ q: term, data: res });
    }
    if (res.exact) return addProduct(res.exact);
    const items = [...res.products.map((p) => ({ kind: "product" as const, p })), ...res.tickets.map((tk) => ({ kind: "ticket" as const, tk }))];
    const pick = items[Math.min(active, items.length - 1)];
    if (!pick) {
      toast.error(t("nothingFound", { q: term }));
      setQ("");
      return;
    }
    if (pick.kind === "product") addProduct(pick.p);
    else addTicket(pick.tk);
  }

  // ---- Cart edits ----
  const updateLine = (key: string, patch: Partial<CartLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? ({ ...l, ...patch } as CartLine) : l)));
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  function reset() {
    setLines([]);
    setCustomer(null);
    setCartDiscount("");
    setPayments([]);
    setChangeCurrency("USD");
    setError(null);
    setDone(null);
    clearSearch();
    // Drop ?ticket= so a refresh doesn't preload the (now paid) repair again.
    if (searchParams.has("ticket")) router.replace(pathname);
  }

  // ---- Checkout ----
  function charge() {
    if (pending || readOnly || done) return;
    if (!lines.length) return setError("emptyCart");
    const badLine = lines.find((l) => {
      const v = l.kind === "PRODUCT" ? (l.discount.trim() ? l.discount : "0") : l.amount;
      return !/^\d+(\.\d{0,2})?$/.test(v.replace(/[,\s]/g, ""));
    });
    if (badLine) return setError("invalidAmount");
    if (needsCustomer) return setError("underpaidNoCustomer");
    if (totals.overpaidNonCash) return setError("overpaidNonCash");
    setError(null);
    startTransition(async () => {
      try {
        const res = await checkout({
          customerId: customer?.id,
          lines: lines.map((l) =>
            l.kind === "PRODUCT"
              ? { kind: "PRODUCT", productId: l.productId, qty: l.qty, discount: l.discount }
              : { kind: "TICKET_BALANCE", ticketId: l.ticketId, amount: l.amount, markPickedUp: l.markPickedUp },
          ),
          cartDiscount,
          payments: payments.filter((p) => p.amount.trim()).map(({ method, currency, amount, reference }) => ({ method, currency, amount, reference })),
          changeCurrency,
        });
        if (!res.ok) {
          setError(res.detail ? `${res.error}|${res.detail}` : res.error);
          return;
        }
        toast.success(t("saleDone", { number: res.number }));
        setDone({ number: res.number, changeAmount: res.changeAmount, changeCurrency: res.changeCurrency, balanceUsdCents: res.balanceUsdCents });
      } catch {
        setError("generic");
      }
    });
  }

  // Ctrl/Cmd+Enter or F9 charges from anywhere on the screen.
  const chargeRef = useRef(charge);
  useEffect(() => {
    chargeRef.current = charge;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F9" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        if (document.querySelector("[role='dialog']")) return;
        e.preventDefault();
        chargeRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [rawCode, errDetail] = (error ?? "").split("|");
  const errCode = rawCode === "discountTooLarge" && !errDetail ? "discountTooLargeCart" : rawCode;
  // Stale errors from an earlier Charge attempt disappear once they no longer apply.
  const stale =
    (errCode === "underpaidNoCustomer" && !needsCustomer) || (errCode === "overpaidNonCash" && !totals.overpaidNonCash);
  const errorText = error && !stale ? (t.has(`errors.${errCode}`) ? t(`errors.${errCode}`, { detail: errDetail ?? "" }) : t("errors.generic")) : null;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_21rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
      {/* ---- Start side: scan / search + results ---- */}
      <section aria-label={t("searchSection")} className="flex min-w-0 flex-col gap-3">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void onSearchEnter();
          }}
          className="relative"
        >
          <label htmlFor="pos-search" className="sr-only">
            {t("searchLabel")}
          </label>
          {q && !fresh ? (
            <Loader2 aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-subtle-foreground" />
          ) : (
            <ScanBarcode aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-subtle-foreground" />
          )}
          <input
            ref={searchRef}
            id="pos-search"
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={t("searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && results.length) {
                e.preventDefault();
                setActive((a) => (a + 1) % results.length);
              } else if (e.key === "ArrowUp" && results.length) {
                e.preventDefault();
                setActive((a) => (a - 1 + results.length) % results.length);
              } else if (e.key === "Escape" && q) {
                e.preventDefault();
                setQ("");
              }
            }}
            className="h-14 w-full rounded-xl border bg-card ps-12 pe-4 text-lg shadow-card outline-none placeholder:text-base placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
          />
        </form>

        <div className="overflow-hidden rounded-xl border bg-card shadow-card md:min-h-64">
          {!debounced ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center md:py-14">
              <div className="flex size-12 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-card">
                <Search className="size-6" aria-hidden />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="font-semibold">{t("searchEmptyTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("searchEmptyBody")}</p>
              </div>
              <p className="mt-2 hidden flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-subtle-foreground md:flex">
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>↵</Kbd> {t("hintAdd")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>F9</Kbd> {t("hintCharge")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>Esc</Kbd> {t("hintClear")}
                </span>
              </p>
            </div>
          ) : fresh && result.error ? (
            <p role="alert" className="px-4 py-10 text-center text-sm text-destructive">
              {tt("error")}
            </p>
          ) : fresh && results.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("nothingFound", { q: debounced })}</p>
          ) : !fresh ? (
            <ul className="divide-y" aria-busy>
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-4">
                  <div className="size-9 animate-pulse rounded-lg bg-muted" />
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="ms-auto h-4 w-16 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          ) : (
            <ul id={listId} role="listbox" aria-label={t("results")} className="divide-y">
              {results.map((r, i) => (
                <li
                  key={r.kind === "product" ? r.p.id : r.tk.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => (r.kind === "product" ? addProduct(r.p) : addTicket(r.tk))}
                  className={cn("flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors", i === active && "bg-accent")}
                >
                  {r.kind === "product" ? (
                    <>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground" aria-hidden>
                        <Package className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.p.name}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {r.p.sku && <Ltr className="font-mono">{r.p.sku}</Ltr>}
                          <span className={cn("tabular-nums", r.p.qty <= 0 && "font-medium text-destructive")}>
                            {r.p.qty <= 0 ? t("outOfStock") : tt("stock", { count: r.p.qty })}
                          </span>
                        </p>
                      </div>
                      <Money usdCents={r.p.priceUsdCents} rate={rate} rounding={rounding} className="items-end text-sm rtl:items-start" />
                    </>
                  ) : (
                    <>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                        <Wrench className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <Ltr>{r.tk.label}</Ltr>
                          <span className="truncate">{r.tk.device}</span>
                          <StatusBadge status={r.tk.status as TicketStatus} />
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{r.tk.customer.name}</p>
                      </div>
                      <div className="flex flex-col items-end text-end rtl:items-start">
                        <span className="text-[11px] text-muted-foreground">{t("balanceDue")}</span>
                        <Money usdCents={r.tk.balanceUsdCents} rate={rate} rounding={rounding} layout="inline" className="text-sm" lbpClassName="hidden" usdClassName="text-warning" />
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---- End side: cart, customer, payment, charge ---- */}
      <section
        ref={cartRef}
        id="cart"
        aria-labelledby="cart-h"
        className="flex min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-xl border bg-card shadow-card md:sticky md:top-20 md:max-h-[calc(100svh-6.5rem)] md:self-start"
      >
        <header className="flex min-h-14 items-center gap-2 border-b px-4">
          <ShoppingCart className="size-4 text-muted-foreground" aria-hidden />
          <h2 id="cart-h" className="font-semibold">
            {t("cart")}
          </h2>
          {itemCount > 0 && <span className="rounded-full bg-secondary px-2 text-xs leading-5 font-medium tabular-nums">{itemCount}</span>}
          {lines.length > 0 && (
            <Button variant="ghost" size="sm" className="ms-auto h-11 text-muted-foreground" onClick={reset}>
              <Trash2 />
              {t("clearCart")}
            </Button>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <ShoppingCart className="size-8 text-subtle-foreground" aria-hidden />
              <p className="text-sm font-medium">{t("cartEmpty")}</p>
              <p className="text-xs text-muted-foreground">{t("cartEmptyBody")}</p>
            </div>
          ) : (
            <ul className="divide-y" aria-label={t("cart")}>
              {lines.map((l) => (
                <CartLineRow key={l.key} line={l} rate={rate} rounding={rounding} onChange={(p) => updateLine(l.key, p)} onRemove={() => removeLine(l.key)} />
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-4 border-t p-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">{t("customer")}</p>
              <PosCustomerPicker value={customer} onChange={setCustomer} required={needsCustomer && (payments.length > 0 || errCode === "underpaidNoCustomer")} />
            </div>

            {lines.length > 0 && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="pos-cart-discount" className="text-sm text-muted-foreground">
                    {t("cartDiscount")}
                  </label>
                  <div className="w-32">
                    <MoneyInput id="pos-cart-discount" value={cartDiscount} onValueChange={setCartDiscount} className="h-11" placeholder="0.00" />
                  </div>
                </div>

                <PaymentRows
                  payments={payments}
                  onChange={setPayments}
                  totals={totals}
                  rate={rate}
                  rounding={rounding}
                />
              </>
            )}
          </div>
        </div>

        {/* Totals + charge: always visible at the bottom of the panel */}
        <footer className="flex flex-col gap-3 border-t bg-muted/30 p-4">
          <dl className="flex flex-col gap-1.5 text-sm">
            {totals.discount > 0 && (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>{t("subtotal")}</dt>
                <dd>
                  <Ltr>{formatMoney(totals.subtotal, "USD")}</Ltr>
                </dd>
              </div>
            )}
            {totals.discount > 0 && (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>{t("discount")}</dt>
                <dd>
                  <Ltr>−{formatMoney(totals.discount, "USD")}</Ltr>
                </dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <dt className="pt-1 font-medium">{t("total")}</dt>
              <dd>
                <Money usdCents={totals.total} rate={rate} rounding={rounding} className="items-end text-2xl rtl:items-start" lbpClassName="text-sm" />
              </dd>
            </div>
            {payments.length > 0 && (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("paid")}</dt>
                  <dd className="font-medium">
                    <Ltr>{formatMoney(totals.tendered, "USD")}</Ltr>
                  </dd>
                </div>
                {totals.remaining > 0 ? (
                  <div className="flex justify-between gap-3 text-warning">
                    <dt className="font-medium">{t("remaining")}</dt>
                    <dd>
                      <Money usdCents={totals.remaining} rate={rate} rounding={rounding} layout="inline" usdClassName="text-warning" />
                    </dd>
                  </div>
                ) : totals.over > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success-soft px-3 py-2 text-success">
                    <dt className="font-medium">{t("change")}</dt>
                    <dd className="flex items-center gap-2">
                      <Segmented
                        label={t("changeCurrency")}
                        value={changeCurrency}
                        onValueChange={setChangeCurrency}
                        options={[
                          { value: "USD", label: "USD" },
                          { value: "LBP", label: "LBP" },
                        ]}
                        className="h-9 bg-card"
                      />
                      <Ltr className="text-lg font-semibold">{formatMoney(totals.change, changeCurrency)}</Ltr>
                    </dd>
                  </div>
                ) : null}
              </>
            )}
          </dl>

          {errorText && (
            <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {errorText}
            </p>
          )}

          <Button size="lg" className="h-14 w-full text-base" onClick={charge} disabled={pending || readOnly || lines.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {totals.remaining > 0 && payments.length > 0 ? t("chargePartial") : t("charge")}
            <Ltr className="font-semibold">{formatMoney(totals.total, "USD")}</Ltr>
            <Kbd className="ms-1 hidden border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground lg:inline-flex">F9</Kbd>
          </Button>
        </footer>
      </section>

      {/* Phone: jump to the cart */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 md:hidden">
          <Button
            className="h-14 w-full justify-between text-base shadow-pop"
            onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart />
              {t("viewCart", { count: itemCount })}
            </span>
            <Ltr className="font-semibold">{formatMoney(totals.total, "USD")}</Ltr>
          </Button>
        </div>
      )}
      <div className="h-16 md:hidden" aria-hidden />

      <DoneDialog info={done} rate={rate} rounding={rounding} onNewSale={reset} />
    </div>
  );
}
