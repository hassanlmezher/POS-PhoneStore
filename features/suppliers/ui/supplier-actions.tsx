"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HandCoins, ListChecks, Loader2, MessageCircle, PackagePlus, Plus, Search, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Money } from "@/components/money";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/segmented";
import { createPurchase, paySupplier, searchStock } from "@/features/suppliers/actions";
import type { ReorderRow } from "@/features/suppliers/queries";
import { PRODUCT_TYPES, type ProductTypeKey } from "@/features/inventory/schema";
import { PayFields, type PayState } from "@/features/suppliers/ui/pay-fields";
import { useDebounced } from "@/lib/use-debounced";
import { useFlip } from "@/lib/use-flip";
import { fillTemplate, waLink } from "@/lib/whatsapp";
import { formatMoney, parseMoney, toLbp } from "@/lib/money";
import { cn } from "@/lib/utils";

type Common = { supplierId: string; today: string; drawerOpen: boolean; rate: number; rounding: number };
const blankPay: PayState = { amount: "", currency: "USD", method: "CASH", fromDrawer: false };

function useSave() {
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }>, onOk: () => void, onFields: (f: Record<string, string>) => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        if (res.fieldErrors) return onFields(res.fieldErrors);
        return void toast.error(te.has(res.error as never) ? te(res.error as never) : te("generic"));
      }
      onOk();
      router.refresh();
    });
  return { pending, run };
}

/**
 * "Pay supplier": prefilled with what is owed (USD), with a "Pay all" shortcut.
 * When the supplier owes the shop, it records money back instead.
 */
export function PayButton({ owedUsdCents, ...c }: Common & { owedUsdCents: number }) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const { pending, run } = useSave();
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<PayState>(blankPay);
  const [day, setDay] = useState(c.today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refund = owedUsdCents < 0;
  const all = Math.abs(owedUsdCents);
  // The whole amount in the chosen currency.
  const allIn = (currency: PayState["currency"]) => (currency === "LBP" ? String(toLbp(all, c.rate, c.rounding)) : (all / 100).toFixed(2));

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setPay({ ...blankPay, amount: all > 0 ? allIn("USD") : "" });
          setDay(c.today);
          setNote("");
          setErrors({});
          setOpen(true);
        }}
      >
        <HandCoins />
        {refund ? t("refund") : t("pay")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{refund ? t("refundTitle") : t("payTitle")}</DialogTitle>
            <DialogDescription>
              {t.rich(refund ? "refundHint" : owedUsdCents > 0 ? "payHint" : "payHintSettled", { amount: formatMoney(all, "USD"), m: (x) => <bdi dir="ltr">{x}</bdi> })}
            </DialogDescription>
          </DialogHeader>
          <form
            id="pay-supplier-form"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pay.amount.trim()) return setErrors({ amount: "required" });
              run(
                () => paySupplier(c.supplierId, { amount: pay.amount, currency: pay.currency, method: pay.method, day, note, fromDrawer: pay.fromDrawer, refund }),
                () => {
                  toast.success(t(refund ? "refunded" : "paid"));
                  setOpen(false);
                },
                setErrors,
              );
            }}
          >
            <PayFields
              idPrefix="sp"
              value={pay}
              onChange={setPay}
              error={errors.amount}
              drawerOpen={c.drawerOpen}
              rate={c.rate}
              rounding={c.rounding}
              label={refund ? t("refundAmount") : t("amount")}
              refund={refund}
            />
            {all > 0 && (
              <Button type="button" variant="secondary" className="self-start" onClick={() => setPay({ ...pay, amount: allIn(pay.currency) })}>
                <Wallet />
                {refund ? t("refundAll") : t("payAll")}
                <bdi dir="ltr" className="font-semibold">
                  {pay.currency === "LBP" ? formatMoney(toLbp(all, c.rate, c.rounding), "LBP") : formatMoney(all, "USD")}
                </bdi>
              </Button>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("date")} htmlFor="sp-day" error={errors.day}>
                <Input {...fieldAria("sp-day", errors.day)} type="date" max={c.today} value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
              <Field label={t("note")} htmlFor="sp-note" optional>
                <Input id="sp-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" form="pay-supplier-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {refund ? t("saveRefund") : t("savePayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A purchase line: an existing product, or a new one (`productId` empty) created with the purchase. */
type Line = {
  key: string;
  productId: string | null;
  name: string;
  qty: string;
  unitCost: string;
  type: ProductTypeKey;
  price: string;
  barcode: string;
};

/** "New purchase": pick products, quantity and unit cost; optional "paid now"; the rest is owed. */
export function PurchaseButton(c: Common) {
  const t = useTranslations("suppliers");
  const tt = useTranslations("productTypes");
  const tc = useTranslations("common");
  const { pending, run } = useSave();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [results, setResults] = useState<{ id: string; name: string; sku: string | null; qty: number; costUsdCents: number }[]>([]);
  const [day, setDay] = useState(c.today);
  const [reference, setReference] = useState("");
  const [pay, setPay] = useState<PayState>(blankPay);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    if (!dq.trim()) return;
    searchStock(dq).then((r) => alive && setResults(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [dq]);

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (parseMoney(l.unitCost, "USD") ?? 0), 0);
  const setLine = (i: number, patch: Partial<Line>) => setLines((cur) => cur.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const blankLine = { qty: "1", type: "ACCESSORY" as const, price: "", barcode: "" };
  function add(p: (typeof results)[number]) {
    setLines((cur) =>
      cur.some((l) => l.productId === p.id)
        ? cur
        : [...cur, { ...blankLine, key: p.id, productId: p.id, name: p.name, unitCost: (p.costUsdCents / 100).toFixed(2) }],
    );
    setQ("");
    setResults([]);
  }
  function addNew() {
    setLines((cur) => [...cur, { ...blankLine, key: `new-${Date.now()}`, productId: null, name: q.trim(), unitCost: "" }]);
    setQ("");
    setResults([]);
  }

  return (
    <>
      <Button
        onClick={() => {
          setLines([]);
          setQ("");
          setResults([]);
          setDay(c.today);
          setReference("");
          setPay(blankPay);
          setErrors({});
          setOpen(true);
        }}
      >
        <PackagePlus />
        {t("newPurchase")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("purchaseTitle")}</DialogTitle>
            <DialogDescription>{t("purchaseHint")}</DialogDescription>
          </DialogHeader>
          <form
            id="purchase-form"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!lines.length) return setErrors({ items: "noItems" });
              const local: Record<string, string> = {};
              lines.forEach((l, i) => {
                if (l.productId) return;
                if (!l.name.trim()) local[`items.${i}.newProduct.name`] = "required";
                if (!l.price.trim()) local[`items.${i}.newProduct.price`] = "required";
              });
              if (!lines.every((l) => l.unitCost.trim())) lines.forEach((l, i) => !l.unitCost.trim() && (local[`items.${i}.unitCost`] = "required"));
              if (Object.keys(local).length) return setErrors(local);
              run(
                () =>
                  createPurchase({
                    supplierId: c.supplierId,
                    day,
                    reference,
                    items: lines.map((l) =>
                      l.productId
                        ? { productId: l.productId, qty: l.qty, unitCost: l.unitCost }
                        : { newProduct: { type: l.type, name: l.name, price: l.price, barcode: l.barcode }, qty: l.qty, unitCost: l.unitCost },
                    ),
                    paid: pay.amount.trim() ? { amount: pay.amount, currency: pay.currency, method: pay.method, day, fromDrawer: pay.fromDrawer } : undefined,
                  }),
                () => {
                  toast.success(t("purchaseSaved"));
                  setOpen(false);
                },
                setErrors,
              );
            }}
          >
            <div className="relative">
              <Field label={t("addProduct")} htmlFor="pu-search" error={errors.items}>
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
                  <Input {...fieldAria("pu-search", errors.items)} autoFocus autoComplete="off" className="ps-9" placeholder={t("searchProduct")} value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </Field>
              {q.trim() && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-pop">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => add(r)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm hover:bg-accent">
                        <span dir="auto" className="min-w-0 flex-1 truncate font-medium rtl:text-right">
                          {r.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{t("inStock", { count: r.qty })}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button type="button" onClick={addNew} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm font-medium text-primary hover:bg-accent">
                      <Plus aria-hidden className="size-4 shrink-0" />
                      <span dir="auto" className="min-w-0 flex-1 truncate rtl:text-right">
                        {t("addNewNamed", { name: q.trim() })}
                      </span>
                    </button>
                  </li>
                </ul>
              )}
              {!q.trim() && (
                <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0" onClick={addNew}>
                  <Plus />
                  {t("addNew")}
                </Button>
              )}
            </div>

            {lines.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border">
                {lines.map((l, i) => {
                  const e = (f: string) => errors[`items.${i}.${f}`];
                  return (
                    <li key={l.key} className="flex flex-col gap-2 p-3">
                      {!l.productId && (
                        <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
                          <p className="text-xs font-semibold text-primary">{t("newProduct")}</p>
                          <Field label={t("productName")} htmlFor={`pu-name-${i}`} error={e("newProduct.name")}>
                            <Input {...fieldAria(`pu-name-${i}`, e("newProduct.name"))} dir="auto" maxLength={150} value={l.name} onChange={(ev) => setLine(i, { name: ev.target.value })} />
                          </Field>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">{t("productType")}</span>
                            <Segmented
                              label={t("productType")}
                              value={l.type}
                              onValueChange={(v) => setLine(i, { type: v })}
                              options={PRODUCT_TYPES.map((v) => ({ value: v, label: tt(v) }))}
                              className="w-full sm:w-96"
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Field label={t("sellPrice")} htmlFor={`pu-price-${i}`} error={e("newProduct.price")}>
                              <MoneyInput {...fieldAria(`pu-price-${i}`, e("newProduct.price"))} value={l.price} onValueChange={(v) => setLine(i, { price: v })} />
                            </Field>
                            <Field label={t("barcode")} htmlFor={`pu-bc-${i}`} optional error={e("newProduct.barcode")}>
                              <Input {...fieldAria(`pu-bc-${i}`, e("newProduct.barcode"))} dir="ltr" className="text-start" maxLength={60} value={l.barcode} onChange={(ev) => setLine(i, { barcode: ev.target.value })} />
                            </Field>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-end gap-2">
                        {l.productId && (
                          <p dir="auto" className="w-full text-sm font-medium rtl:text-right sm:w-auto sm:min-w-0 sm:flex-1 sm:self-center">
                            {l.name}
                          </p>
                        )}
                        <Field label={t("qty")} htmlFor={`pu-qty-${i}`} error={e("qty")} className="w-20">
                          <Input id={`pu-qty-${i}`} type="number" inputMode="numeric" min={1} value={l.qty} onChange={(ev) => setLine(i, { qty: ev.target.value })} />
                        </Field>
                        <Field label={t("unitCost")} htmlFor={`pu-cost-${i}`} error={e("unitCost")} className="w-32">
                          <MoneyInput id={`pu-cost-${i}`} value={l.unitCost} onValueChange={(v) => setLine(i, { unitCost: v })} />
                        </Field>
                        <Button type="button" variant="ghost" size="icon" className={cn(!l.productId && "ms-auto")} aria-label={t("removeLine")} onClick={() => setLines((cur) => cur.filter((_, j) => j !== i))}>
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  );
                })}
                <li className="flex items-center justify-between gap-3 bg-muted/40 p-3 font-semibold">
                  <span>{t("total")}</span>
                  <Money usdCents={total} rate={c.rate} rounding={c.rounding} layout="inline" lbpClassName="text-xs font-normal" />
                </li>
              </ul>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("date")} htmlFor="pu-day">
                <Input id="pu-day" type="date" max={c.today} value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
              <Field label={t("reference")} htmlFor="pu-ref" optional>
                <Input id="pu-ref" maxLength={60} placeholder={t("referencePlaceholder")} value={reference} onChange={(e) => setReference(e.target.value)} />
              </Field>
            </div>
            <div className="rounded-lg border p-3">
              <PayFields
                idPrefix="pu-pay"
                value={pay}
                onChange={setPay}
                error={errors["paid.amount"]}
                drawerOpen={c.drawerOpen}
                rate={c.rate}
                rounding={c.rounding}
                label={t("paidNow")}
                optional
              />
              <p className="mt-2 text-xs text-muted-foreground">{t("paidNowHint")}</p>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" form="purchase-form" disabled={pending || !lines.length}>
              {pending && <Loader2 className="animate-spin" />}
              {t("savePurchase")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "What to order": low-stock products with quantities, sent to the supplier on WhatsApp. */
export function ReorderButton({ rows, phone, texts, supplierName, shopName }: { rows: ReorderRow[]; phone: string | null; texts: { body: string; line: string }; supplierName: string; shopName: string }) {
  const t = useTranslations("suppliers");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [find, setFind] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const term = find.trim().toLowerCase();
  // Ticked products first so the order is easy to check; otherwise least in stock first.
  const shown = [...(term ? rows.filter((r) => r.name.toLowerCase().includes(term)) : rows)].sort((a, b) => Number(b.id in picked) - Number(a.id in picked));
  // Ticked rows slide up to the top.
  useFlip(listRef);
  const items = rows.filter((r) => picked[r.id] && Number(picked[r.id]) > 0);
  const message = fillTemplate(texts.body, {
    supplier: supplierName,
    shop: shopName,
    lines: items.map((r) => fillTemplate(texts.line, { qty: picked[r.id], name: r.name })).join("\n"),
  });
  const href = phone ? waLink(phone, message) : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setPicked(Object.fromEntries(rows.filter((r) => r.fromSupplier).map((r) => [r.id, String(r.suggested)])));
          setFind("");
          setOpen(true);
        }}
      >
        <ListChecks />
        {t("whatToOrder")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Only the list scrolls: search, preview and the send button stay in view. */}
        <DialogContent className="overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t("whatToOrder")}</DialogTitle>
            <DialogDescription>{t("reorderHint")}</DialogDescription>
          </DialogHeader>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("nothingLow")}</p>
          ) : (
            <>
            <div className="relative shrink-0">
              <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input type="search" aria-label={t("findProduct")} placeholder={t("findProduct")} className="ps-9" value={find} onChange={(e) => setFind(e.target.value)} />
            </div>
            {shown.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">{t("noMatch")}</p>}
            <ul ref={listRef} className={cn("relative -mt-2 flex min-h-24 flex-col divide-y overflow-y-auto overscroll-contain rounded-lg border", shown.length === 0 && "hidden")}>
              {shown.map((r) => {
                const on = !!picked[r.id];
                return (
                  <li key={r.id} data-flip-id={r.id} className={cn("relative flex min-h-14 shrink-0 items-center gap-3 px-3 py-2 transition-colors", on ? "z-10 bg-primary-soft" : "bg-card")}>
                    <input
                      type="checkbox"
                      id={`ro-${r.id}`}
                      className="size-5 shrink-0 accent-[var(--color-primary)]"
                      checked={on}
                      onChange={(e) =>
                        setPicked((cur) => {
                          const next = { ...cur };
                          if (e.target.checked) {
                            next[r.id] = String(r.suggested);
                            // Follow the row up to the top of the list.
                            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                            listRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
                          } else delete next[r.id];
                          return next;
                        })
                      }
                    />
                    <label htmlFor={`ro-${r.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span dir="auto" className="block truncate text-sm font-medium rtl:text-right">
                        {r.name}
                      </span>
                      <span className={cn("text-xs", r.qty <= 0 ? "text-destructive" : "text-muted-foreground")}>
                        {t("inStock", { count: r.qty })}
                        {r.fromSupplier && ` · ${t("boughtHere")}`}
                      </span>
                    </label>
                    {on ? (
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        aria-label={t("qtyFor", { name: r.name })}
                        className="h-10 w-20 shrink-0 text-center"
                        value={picked[r.id]}
                        onChange={(e) => setPicked((cur) => ({ ...cur, [r.id]: e.target.value }))}
                      />
                    ) : (
                      <span className="w-20 shrink-0 text-center text-xs text-muted-foreground">{t("suggested", { count: r.suggested })}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            </>
          )}
          {items.length > 0 && (
            <div className="max-h-24 shrink-0 overflow-y-auto rounded-lg bg-wa-wallpaper p-2.5 sm:max-h-32">
              <p className="w-fit max-w-full rounded-lg bg-wa-bubble px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-wa-text shadow-card [overflow-wrap:anywhere]">{message}</p>
            </div>
          )}
          <DialogFooter className="shrink-0">
            <Button asChild className={cn("bg-success text-success-foreground hover:bg-success/90", !items.length && "pointer-events-none opacity-50")} aria-disabled={!items.length}>
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                <MessageCircle />
                {t("sendOrder", { count: items.length })}
              </a>
            </Button>
          </DialogFooter>
          {!phone && <p className="text-xs text-muted-foreground">{t("noPhoneHint")}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
