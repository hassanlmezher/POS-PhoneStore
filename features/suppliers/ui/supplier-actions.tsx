"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HandCoins, ListChecks, Loader2, MessageCircle, PackagePlus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Money } from "@/components/money";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPurchase, paySupplier, searchStock } from "@/features/suppliers/actions";
import type { ReorderRow } from "@/features/suppliers/queries";
import { PayFields, type PayState } from "@/features/suppliers/ui/pay-fields";
import { useDebounced } from "@/lib/use-debounced";
import { fillTemplate, waLink } from "@/lib/whatsapp";
import { formatMoney, parseMoney } from "@/lib/money";
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

/** "Pay supplier": prefilled with what is owed (USD). */
export function PayButton({ owedUsdCents, ...c }: Common & { owedUsdCents: number }) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const { pending, run } = useSave();
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<PayState>(blankPay);
  const [day, setDay] = useState(c.today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setPay({ ...blankPay, amount: owedUsdCents > 0 ? (owedUsdCents / 100).toFixed(2) : "" });
          setDay(c.today);
          setNote("");
          setErrors({});
          setOpen(true);
        }}
      >
        <HandCoins />
        {t("pay")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("payTitle")}</DialogTitle>
            <DialogDescription>{t.rich("payHint", { amount: formatMoney(Math.max(0, owedUsdCents), "USD"), m: (x) => <bdi dir="ltr">{x}</bdi> })}</DialogDescription>
          </DialogHeader>
          <form
            id="pay-supplier-form"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pay.amount.trim()) return setErrors({ amount: "required" });
              run(
                () => paySupplier(c.supplierId, { amount: pay.amount, currency: pay.currency, method: pay.method, day, note, fromDrawer: pay.fromDrawer }),
                () => {
                  toast.success(t("paid"));
                  setOpen(false);
                },
                setErrors,
              );
            }}
          >
            <PayFields idPrefix="sp" value={pay} onChange={setPay} error={errors.amount} drawerOpen={c.drawerOpen} rate={c.rate} rounding={c.rounding} label={t("amount")} />
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
              {t("savePayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Line = { productId: string; name: string; qty: string; unitCost: string };

/** "New purchase": pick products, quantity and unit cost; optional "paid now"; the rest is owed. */
export function PurchaseButton(c: Common) {
  const t = useTranslations("suppliers");
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

  function add(p: (typeof results)[number]) {
    setLines((cur) =>
      cur.some((l) => l.productId === p.id)
        ? cur
        : [...cur, { productId: p.id, name: p.name, qty: "1", unitCost: (p.costUsdCents / 100).toFixed(2) }],
    );
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
              run(
                () =>
                  createPurchase({
                    supplierId: c.supplierId,
                    day,
                    reference,
                    items: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })),
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
              {q.trim() && results.length > 0 && (
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
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border">
                {lines.map((l, i) => (
                  <li key={l.productId} className="flex flex-wrap items-end gap-2 p-3">
                    <p dir="auto" className="w-full text-sm font-medium rtl:text-right sm:w-auto sm:min-w-0 sm:flex-1 sm:self-center">
                      {l.name}
                    </p>
                    <Field label={t("qty")} htmlFor={`pu-qty-${i}`} error={errors[`items.${i}.qty`]} className="w-20">
                      <Input id={`pu-qty-${i}`} type="number" inputMode="numeric" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                    </Field>
                    <Field label={t("unitCost")} htmlFor={`pu-cost-${i}`} error={errors[`items.${i}.unitCost`]} className="w-32">
                      <MoneyInput id={`pu-cost-${i}`} value={l.unitCost} onValueChange={(v) => setLine(i, { unitCost: v })} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" aria-label={t("removeLine")} onClick={() => setLines((cur) => cur.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
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
          setOpen(true);
        }}
      >
        <ListChecks />
        {t("whatToOrder")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("whatToOrder")}</DialogTitle>
            <DialogDescription>{t("reorderHint")}</DialogDescription>
          </DialogHeader>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("nothingLow")}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {rows.map((r) => {
                const on = !!picked[r.id];
                return (
                  <li key={r.id} className="flex items-center gap-3 p-2.5">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-primary)]"
                      aria-label={r.name}
                      checked={on}
                      onChange={(e) =>
                        setPicked((cur) => {
                          const next = { ...cur };
                          if (e.target.checked) next[r.id] = String(r.suggested);
                          else delete next[r.id];
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span dir="auto" className="block truncate text-sm font-medium rtl:text-right">
                        {r.name}
                      </span>
                      <span className={cn("text-xs", r.qty <= 0 ? "text-destructive" : "text-muted-foreground")}>
                        {t("inStock", { count: r.qty })}
                        {r.fromSupplier && ` · ${t("boughtHere")}`}
                      </span>
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      aria-label={t("qty")}
                      className="h-10 w-20"
                      disabled={!on}
                      value={picked[r.id] ?? ""}
                      onChange={(e) => setPicked((cur) => ({ ...cur, [r.id]: e.target.value }))}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 0 && (
            <div className="rounded-lg bg-wa-wallpaper p-3">
              <p className="w-fit max-w-full rounded-lg bg-wa-bubble px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-wa-text shadow-card [overflow-wrap:anywhere]">{message}</p>
            </div>
          )}
          <DialogFooter>
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
