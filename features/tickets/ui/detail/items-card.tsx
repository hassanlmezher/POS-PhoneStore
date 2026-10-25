"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Package, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Field, fieldAria } from "@/components/field";
import { Money } from "@/components/money";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTicketItem, removeTicketItem, searchParts } from "@/features/tickets/actions";
import { formatMoney } from "@/lib/money";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

type Item = { id: string; kind: "PART" | "LABOR"; description: string; qty: number; unitPriceUsdCents: number; productId: string | null };
type Part = Awaited<ReturnType<typeof searchParts>>[number];

type Props = { ticketId: string; items: Item[]; totalUsdCents: number; canEdit: boolean; rate: number; rounding: number };

export function ItemsCard({ ticketId, items, totalUsdCents, canEdit, rate, rounding }: Props) {
  const t = useTranslations("ticket");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  function remove(item: Item) {
    startTransition(async () => {
      try {
        const res = await removeTicketItem(item.id);
        if (!res.ok) return void toast.error(t("saveFailed"));
        toast.success(item.productId ? t("itemRemovedStock") : t("itemRemoved"));
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  return (
    <section aria-labelledby="items-h" className="overflow-hidden rounded-xl border bg-card shadow-card">
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <h2 id="items-h" className="font-semibold">
          {t("items")}
        </h2>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" className="ms-auto" onClick={() => setAdding(true)}>
            <Plus />
            {t("addItem")}
          </Button>
        )}
      </header>

      {items.length === 0 && !adding ? (
        <EmptyState icon={Package} title={t("noItems")} body={t("noItemsBody")} className="py-8" />
      ) : (
        items.length > 0 && (
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {i.kind === "PART" ? <Package className="size-4" aria-hidden /> : <Wrench className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.description}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t(i.kind === "PART" ? "part" : "labor")}
                    {i.qty > 1 && (
                      <>
                        {" · "}
                        <bdi dir="ltr">
                          {i.qty} × {formatMoney(i.unitPriceUsdCents, "USD")}
                        </bdi>
                      </>
                    )}
                  </p>
                </div>
                <Money usdCents={i.qty * i.unitPriceUsdCents} rate={rate} rounding={rounding} className="items-end text-sm rtl:items-start" />
                {canEdit && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("removeItem", { name: i.description })} disabled={pending}>
                        <Trash2 />
                      </Button>
                    }
                    title={t("removeItemTitle")}
                    body={i.productId ? t("removeItemStockBody") : t("removeItemBody")}
                    confirmLabel={tc("remove")}
                    onConfirm={() => remove(i)}
                  />
                )}
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3 sm:px-6">
              <span className="text-sm font-medium">{t("itemsTotal")}</span>
              <Money usdCents={totalUsdCents} rate={rate} rounding={rounding} className="items-end rtl:items-start" />
            </li>
          </ul>
        )
      )}

      {adding && <AddItemForm ticketId={ticketId} rate={rate} rounding={rounding} onDone={() => setAdding(false)} />}
    </section>
  );
}

function AddItemForm({ ticketId, rate, rounding, onDone }: { ticketId: string; rate: number; rounding: number; onDone: () => void }) {
  const t = useTranslations("ticket");
  const tc = useTranslations("common");
  const listId = useId();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"PART" | "LABOR">("PART");
  const [query, setQuery] = useState("");
  const [part, setPart] = useState<Part | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debounced = useDebounced(query, 200);

  useEffect(() => {
    if (kind !== "PART" || part) return;
    let stale = false;
    searchParts(debounced)
      .then((rows) => {
        if (!stale) {
          setParts(rows);
          setActive(0);
        }
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [debounced, kind, part]);

  function choose(p: Part) {
    setPart(p);
    setDescription(p.name);
    setPrice((p.priceUsdCents / 100).toFixed(2));
    setOpen(false);
    requestAnimationFrame(() => document.getElementById("item-price")?.focus());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (kind === "PART" && !part) local.productId = "required";
    if (kind === "LABOR" && !description.trim()) local.description = "required";
    if (!price.trim()) local.unitPrice = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      try {
        const res = await addTicketItem(ticketId, {
          kind,
          productId: kind === "PART" ? part?.id : undefined,
          description: kind === "PART" ? (part?.name ?? description) : description,
          qty: Number(qty) || 1,
          unitPrice: price,
        });
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          if (!res.fieldErrors) toast.error(t("saveFailed"));
          return;
        }
        toast.success(kind === "PART" ? t("partAdded") : t("laborAdded"));
        onDone();
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  const outOfStock = part && part.qty - (Number(qty) || 1) < 0;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border-t bg-muted/20 p-4 sm:p-6" noValidate>
      <Segmented
        label={t("itemKind")}
        value={kind}
        onValueChange={(k) => {
          setKind(k);
          setErrors({});
        }}
        options={[
          { value: "PART", label: t("part") },
          { value: "LABOR", label: t("labor") },
        ]}
        className="w-full sm:w-64"
      />
      {kind === "PART" ? (
        part ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Package aria-hidden className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{part.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{t("inStock", { count: part.qty })}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPart(null)}>
                {tc("change")}
              </Button>
            </div>
            {outOfStock && (
              <p role="alert" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                <AlertTriangle aria-hidden className="size-4 shrink-0" />
                {t("noStockWarning")}
              </p>
            )}
          </div>
        ) : (
          <Field label={t("findPart")} htmlFor="item-part" error={errors.productId}>
            <div className="relative">
              <Input
                {...fieldAria("item-part", errors.productId)}
                autoFocus
                role="combobox"
                aria-expanded={open && parts.length > 0}
                aria-controls={listId}
                aria-activedescendant={open && parts[active] ? `${listId}-${active}` : undefined}
                autoComplete="off"
                placeholder={t("findPartPlaceholder")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && parts.length) {
                    e.preventDefault();
                    setActive((a) => (a + 1) % parts.length);
                  } else if (e.key === "ArrowUp" && parts.length) {
                    e.preventDefault();
                    setActive((a) => (a - 1 + parts.length) % parts.length);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (parts[active]) choose(parts[active]);
                  }
                }}
              />
              {open && (
                <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-pop">
                  {parts.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{t("noParts")}</li>}
                  {parts.map((p, i) => (
                    <li
                      key={p.id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(p)}
                      onMouseEnter={() => setActive(i)}
                      className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", i === active && "bg-accent")}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className={cn("text-xs tabular-nums", p.qty <= 0 ? "font-medium text-destructive" : "text-muted-foreground")}>
                        {t("inStock", { count: p.qty })}
                      </span>
                      <bdi dir="ltr" className="text-xs tabular-nums">
                        {formatMoney(p.priceUsdCents, "USD")}
                      </bdi>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
        )
      ) : (
        <Field label={t("laborDescription")} htmlFor="item-desc" error={errors.description}>
          <Input
            {...fieldAria("item-desc", errors.description)}
            autoFocus
            autoComplete="off"
            placeholder={t("laborPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      )}
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 sm:max-w-md">
        <Field label={t("qty")} htmlFor="item-qty" error={errors.qty}>
          <Input
            {...fieldAria("item-qty", errors.qty)}
            type="number"
            inputMode="numeric"
            min={1}
            dir="ltr"
            className="text-start tabular-nums"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <Field label={t("unitPrice")} htmlFor="item-price" error={errors.unitPrice}>
          <MoneyInput {...fieldAria("item-price", errors.unitPrice)} value={price} onValueChange={setPrice} rate={rate} rounding={rounding} placeholder="0.00" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          {t("addItem")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
