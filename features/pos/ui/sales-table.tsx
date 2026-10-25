"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Compact row data: rendering here (not in the server page) keeps the page payload ~10× smaller per row. */
export type SaleRow = {
  id: string;
  number: number;
  date: string;
  customer: string | null;
  items: number;
  totalUsdCents: number;
  voided: boolean;
  methods: string;
  balanceUsdCents: number;
  cashier: string;
};

/** One table for every screen size (columns hide on small screens). */
export function SalesTable({ rows, rate, rounding }: { rows: SaleRow[]; rate: number; rounding: number }) {
  const t = useTranslations("sales");
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="lg:w-20">#</TableHead>
          <TableHead className="hidden lg:table-cell">{t("date")}</TableHead>
          <TableHead className="hidden lg:table-cell">{t("customer")}</TableHead>
          <TableHead className="hidden text-end xl:table-cell">{t("items")}</TableHead>
          <TableHead className="text-end">{t("total")}</TableHead>
          <TableHead className="hidden xl:table-cell">{t("payment")}</TableHead>
          <TableHead className="hidden text-end lg:table-cell">{t("balance")}</TableHead>
          <TableHead className="hidden 2xl:table-cell">{t("cashier")}</TableHead>
          <TableHead className="hidden w-10 px-2 lg:table-cell" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.id} className={cn("relative", s.voided && "text-muted-foreground")}>
            {/* On phones and tablets this cell also shows the customer and date (their columns are hidden). */}
            <TableCell className="w-full max-w-0 py-2.5 font-semibold lg:w-auto lg:max-w-none">
              <Link href={`/sales/${s.number}`} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                <Ltr>#{s.number}</Ltr>
              </Link>
              <span className="block truncate font-normal lg:hidden">{s.customer ?? <span className="text-subtle-foreground">{t("walkIn")}</span>}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground lg:hidden">{s.date}</span>
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{s.date}</TableCell>
            <TableCell className="hidden max-w-48 truncate lg:table-cell">
              {s.customer ?? <span className="text-subtle-foreground">{t("walkIn")}</span>}
            </TableCell>
            <TableCell className="hidden text-end tabular-nums xl:table-cell">{s.items}</TableCell>
            <TableCell className="py-2 text-end">
              {s.voided ? (
                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                  <Badge variant="destructive">{t("voided")}</Badge>
                  <Ltr className="hidden line-through lg:inline">{formatMoney(s.totalUsdCents, "USD")}</Ltr>
                </span>
              ) : (
                <Money usdCents={s.totalUsdCents} rate={rate} rounding={rounding} className="items-end whitespace-nowrap rtl:items-start" />
              )}
              {s.balanceUsdCents > 0 && (
                <span className="block text-xs text-warning lg:hidden">{t("owes", { amount: formatMoney(s.balanceUsdCents, "USD") })}</span>
              )}
            </TableCell>
            <TableCell className="hidden max-w-40 truncate text-muted-foreground xl:table-cell">{s.methods || "—"}</TableCell>
            <TableCell className="hidden text-end lg:table-cell">
              {s.balanceUsdCents > 0 ? (
                <Ltr className="font-medium text-warning">{formatMoney(s.balanceUsdCents, "USD")}</Ltr>
              ) : (
                <span className="text-subtle-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="hidden text-muted-foreground 2xl:table-cell">{s.cashier}</TableCell>
            <TableCell className="hidden px-2 lg:table-cell">
              <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
