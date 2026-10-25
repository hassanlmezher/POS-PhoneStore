"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, Tag, X } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { MoneyInput } from "@/components/money-input";
import { StatusBadge, type TicketStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney, parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { lineTotal, usdOrZero, type CartLine } from "./cart";

type Props = {
  line: CartLine;
  rate: number;
  rounding: number;
  onChange: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
};

export function CartLineRow({ line, rate, rounding, onChange, onRemove }: Props) {
  const t = useTranslations("pos");
  const total = lineTotal(line);

  if (line.kind === "TICKET_BALANCE") {
    const amount = line.amount.trim() ? parseMoney(line.amount, "USD") : null;
    const tooMuch = amount !== null && amount > line.balanceUsdCents;
    const invalid = amount === null || amount <= 0 || tooMuch;
    const id = `amt-${line.key}`;
    return (
      <li className="flex flex-col gap-3 px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Ltr>{line.label}</Ltr>
              <StatusBadge status={line.status as TicketStatus} />
            </p>
            <p className="truncate text-xs text-muted-foreground">{line.device}</p>
            <p className="text-xs text-muted-foreground">
              {t("repairBalance")} <Ltr className="font-medium text-foreground">{formatMoney(line.balanceUsdCents, "USD")}</Ltr>
            </p>
          </div>
          <Button variant="ghost" size="icon" className="-me-2 -mt-1 text-muted-foreground" onClick={onRemove} aria-label={t("removeLine", { name: line.label })}>
            <X />
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
            {t("payNow")}
          </label>
          <MoneyInput
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={`${id}-err`}
            value={line.amount}
            onValueChange={(v) => onChange({ amount: v })}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11"
          />
          {tooMuch && (
            <p id={`${id}-err`} className="text-xs text-destructive">
              {t("amountOverBalance")}
            </p>
          )}
        </div>
        <label className="-my-1 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-4.5 accent-primary" checked={line.markPickedUp} onChange={(e) => onChange({ markPickedUp: e.target.checked })} />
          {t("markPickedUp")}
        </label>
      </li>
    );
  }

  return <ProductLineRow line={line} total={total} rate={rate} rounding={rounding} onChange={onChange} onRemove={onRemove} />;
}

function ProductLineRow({
  line,
  total,
  onChange,
  onRemove,
}: Omit<Props, "line"> & { line: Extract<CartLine, { kind: "PRODUCT" }>; total: number | null }) {
  const t = useTranslations("pos");
  const [showDiscount, setShowDiscount] = useState(!!line.discount);
  const discount = usdOrZero(line.discount);
  const gross = line.unitPriceUsdCents * line.qty;
  const discountBad = discount === null || discount > gross;
  const lowStock = line.qty > line.stock;
  const id = `disc-${line.key}`;

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium">{line.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            <Ltr>{formatMoney(line.unitPriceUsdCents, "USD")}</Ltr>
            {line.sku && (
              <>
                {" · "}
                <Ltr className="font-mono">{line.sku}</Ltr>
              </>
            )}
          </p>
        </div>
        <div className="text-end">
          <Ltr className={cn("block text-sm font-semibold", discountBad && "text-destructive")}>{formatMoney(Math.max(0, total ?? gross), "USD")}</Ltr>
          {!!discount && !discountBad && (
            <Ltr className="block text-xs text-muted-foreground line-through">{formatMoney(gross, "USD")}</Ltr>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border" role="group" aria-label={t("quantityOf", { name: line.name })}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-e-none"
            onClick={() => (line.qty > 1 ? onChange({ qty: line.qty - 1 }) : onRemove())}
            aria-label={line.qty > 1 ? t("decrease") : t("removeLine", { name: line.name })}
          >
            <Minus />
          </Button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            dir="ltr"
            aria-label={t("quantity")}
            value={line.qty}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value));
              if (n >= 1 && n <= 9999) onChange({ qty: n });
            }}
            className="h-11 w-12 border-x bg-transparent text-center text-sm font-semibold tabular-nums outline-none focus-visible:bg-primary-soft [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Button variant="ghost" size="icon" className="rounded-s-none" onClick={() => onChange({ qty: line.qty + 1 })} aria-label={t("increase")}>
            <Plus />
          </Button>
        </div>
        {!showDiscount && (
          <Button variant="ghost" size="sm" className="h-11 text-muted-foreground" onClick={() => setShowDiscount(true)}>
            <Tag />
            {t("lineDiscount")}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="ms-auto text-muted-foreground" onClick={onRemove} aria-label={t("removeLine", { name: line.name })}>
          <X />
        </Button>
      </div>
      {showDiscount && (
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="shrink-0 text-xs text-muted-foreground">
            {t("lineDiscount")}
          </label>
          <div className="w-28">
            <MoneyInput id={id} autoFocus aria-invalid={discountBad || undefined} value={line.discount} onValueChange={(v) => onChange({ discount: v })} className="h-11" placeholder="0.00" />
          </div>
          {discountBad && <p className="text-xs text-destructive">{t("discountTooBig")}</p>}
        </div>
      )}
      {lowStock && (
        <p className="text-xs text-warning">{line.stock <= 0 ? t("noStockLeft") : t("onlyInStock", { count: line.stock })}</p>
      )}
    </li>
  );
}
