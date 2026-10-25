"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, Printer, X } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { StockLevel } from "@/components/stock-level";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { marginPercent } from "@/features/inventory/margin";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type InventoryRow = {
  id: string;
  type: "ACCESSORY" | "PART";
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  costUsdCents: number;
  priceUsdCents: number;
  qty: number;
  lowStockThreshold: number;
  active: boolean;
};

type Props = { rows: InventoryRow[]; showCost: boolean; rate: number; rounding: number };

function Codes({ sku, barcode }: { sku: string | null; barcode: string | null }) {
  if (!sku && !barcode) return null;
  return (
    <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
      {sku && <Ltr className="font-mono">{sku}</Ltr>}
      {barcode && barcode !== sku && <Ltr className="font-mono text-subtle-foreground">{barcode}</Ltr>}
    </span>
  );
}

/** Product table with row selection for printing labels in bulk. */
export function InventoryTable({ rows, showCost, rate, rounding }: Props) {
  const t = useTranslations("inventory");
  const tt = useTranslations("productTypes");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  const checkbox = (id: string, name: string) => (
    <label className="relative z-10 -m-3 flex size-11 cursor-pointer items-center justify-center">
      <span className="sr-only">{t("selectRow", { name })}</span>
      <input type="checkbox" className="size-4.5 cursor-pointer accent-primary" checked={selected.has(id)} onChange={() => toggle(id)} />
    </label>
  );

  return (
    <>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary-soft/60 px-3 py-2 sm:px-4" role="region" aria-label={t("bulkActions")}>
          <p className="text-sm font-medium tabular-nums">{t("selected", { count: selected.size })}</p>
          <div className="ms-auto flex gap-2">
            <Button size="sm" variant="ghost" className="h-11 sm:h-9" onClick={() => setSelected(new Set())}>
              <X />
              {t("clearSelection")}
            </Button>
            <Button size="sm" className="h-11 sm:h-9" asChild>
              <a href={`/print/labels?ids=${[...selected].join(",")}`} target="_blank" rel="noopener">
                <Printer />
                {t("printLabels")}
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Tablet/desktop */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12">
              <label className="-m-3 flex size-11 cursor-pointer items-center justify-center">
                <span className="sr-only">{t("selectAll")}</span>
                <input type="checkbox" className="size-4.5 cursor-pointer accent-primary" checked={allSelected} onChange={toggleAll} />
              </label>
            </TableHead>
            <TableHead>{t("name")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("category")}</TableHead>
            <TableHead>{t("type")}</TableHead>
            <TableHead className="text-end">{t("stock")}</TableHead>
            <TableHead className="text-end">{t("price")}</TableHead>
            {showCost && <TableHead className="hidden text-end xl:table-cell">{t("costMargin")}</TableHead>}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const margin = marginPercent(p.priceUsdCents, p.costUsdCents);
            return (
              <TableRow key={p.id} className={cn("relative", selected.has(p.id) && "bg-primary-soft/40", !p.active && "opacity-60")}>
                <TableCell>{checkbox(p.id, p.name)}</TableCell>
                <TableCell className="max-w-72">
                  <Link href={`/inventory/${p.id}`} className="block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline">
                    {p.name}
                  </Link>
                  <Codes sku={p.sku} barcode={p.barcode} />
                  {!p.active && (
                    <Badge variant="secondary" className="mt-1">
                      {t("archived")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{p.category ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={p.type === "PART" ? "soft" : "secondary"}>{tt(p.type)}</Badge>
                </TableCell>
                <TableCell className="text-end">
                  <StockLevel qty={p.qty} threshold={p.lowStockThreshold} />
                </TableCell>
                <TableCell className="text-end">
                  <Money usdCents={p.priceUsdCents} rate={rate} rounding={rounding} className="items-end whitespace-nowrap rtl:items-start" />
                </TableCell>
                {showCost && (
                  <TableCell className="hidden text-end xl:table-cell">
                    <span className="flex flex-col items-end text-sm tabular-nums rtl:items-start">
                      <bdi dir="ltr" className="text-muted-foreground">
                        {formatMoney(p.costUsdCents, "USD")}
                      </bdi>
                      <span className={cn("text-xs", margin !== null && margin < 0 ? "text-destructive" : "text-success")}>
                        {margin === null ? "—" : <bdi dir="ltr">{margin}%</bdi>}
                      </span>
                    </span>
                  </TableCell>
                )}
                <TableCell>
                  <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Phone */}
      <ul className="divide-y md:hidden">
        {rows.map((p) => (
          <li key={p.id} className={cn("relative flex items-center gap-3 px-4 py-3", selected.has(p.id) && "bg-primary-soft/40", !p.active && "opacity-60")}>
            {checkbox(p.id, p.name)}
            <div className="min-w-0 flex-1">
              <Link href={`/inventory/${p.id}`} className="block truncate font-medium after:absolute after:inset-0">
                {p.name}
              </Link>
              <Codes sku={p.sku} barcode={p.barcode} />
            </div>
            <div className="flex flex-col items-end gap-1 rtl:items-start">
              <Money usdCents={p.priceUsdCents} rate={rate} rounding={rounding} layout="inline" className="text-sm" lbpClassName="hidden" />
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {t("stock")}
                <StockLevel qty={p.qty} threshold={p.lowStockThreshold} showLabel={false} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
