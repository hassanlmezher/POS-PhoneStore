import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DrawerTotals } from "@/features/cash/queries";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CashDiff, signedMoney } from "./cash-diff";

type Counted = { expectedUsdCents: number; expectedLbp: number; countedUsdCents: number; countedLbp: number };

/** Per-currency breakdown: opening → cash in → change → pay-ins/outs → expected (→ counted → difference). */
export function DrawerBreakdown({ totals, counted }: { totals: DrawerTotals; counted?: Counted }) {
  const t = useTranslations("cash");
  const rows: { label: string; usd: number; lbp: number; sign: 0 | 1 | -1 }[] = [
    { label: t("opening"), usd: totals.openingUsdCents, lbp: totals.openingLbp, sign: 0 },
    { label: t("cashIn"), usd: totals.cashInUsdCents, lbp: totals.cashInLbp, sign: 1 },
    { label: t("changeOut"), usd: totals.changeOutUsdCents, lbp: totals.changeOutLbp, sign: -1 },
    { label: t("payIns"), usd: totals.payInUsdCents, lbp: totals.payInLbp, sign: 1 },
    { label: t("payOuts"), usd: totals.payOutUsdCents, lbp: totals.payOutLbp, sign: -1 },
  ];
  const expectedUsd = counted?.expectedUsdCents ?? totals.expectedUsdCents;
  const expectedLbp = counted?.expectedLbp ?? totals.expectedLbp;
  const cell = (v: number, sign: 0 | 1 | -1, currency: "USD" | "LBP") => (
    <bdi dir="ltr" className={cn("whitespace-nowrap tabular-nums", v === 0 && "text-subtle-foreground")}>
      {/* The column header names the currency, so LBP amounts drop the suffix (keeps the table phone-width). */}
      {(sign === 0 || v === 0 ? formatMoney(v, currency) : signedMoney(sign * v, currency)).replace(/\s*LBP$/, "")}
    </bdi>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="ps-4 pe-2 sm:ps-6 sm:pe-4">
            <span className="sr-only">{t("item")}</span>
          </TableHead>
          <TableHead className="px-2 text-end sm:px-4">USD</TableHead>
          <TableHead className="ps-2 pe-4 text-end sm:ps-4 sm:pe-6">LBP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label} className="hover:bg-transparent">
            <TableCell className="h-12 ps-4 pe-2 text-muted-foreground sm:ps-6 sm:pe-4">{r.label}</TableCell>
            <TableCell className="h-12 px-2 text-end sm:px-4">{cell(r.usd, r.sign, "USD")}</TableCell>
            <TableCell className="h-12 ps-2 pe-4 text-end sm:ps-4 sm:pe-6">{cell(r.lbp, r.sign, "LBP")}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
          <TableCell className="ps-4 pe-2 sm:ps-6 sm:pe-4">{t("expected")}</TableCell>
          <TableCell className="px-2 text-end sm:px-4">{cell(expectedUsd, 0, "USD")}</TableCell>
          <TableCell className="ps-2 pe-4 text-end sm:ps-4 sm:pe-6">{cell(expectedLbp, 0, "LBP")}</TableCell>
        </TableRow>
        {counted && (
          <>
            <TableRow className="hover:bg-transparent">
              <TableCell className="ps-4 pe-2 sm:ps-6 sm:pe-4">{t("counted")}</TableCell>
              <TableCell className="px-2 text-end sm:px-4">{cell(counted.countedUsdCents, 0, "USD")}</TableCell>
              <TableCell className="ps-2 pe-4 text-end sm:ps-4 sm:pe-6">{cell(counted.countedLbp, 0, "LBP")}</TableCell>
            </TableRow>
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableCell className="ps-4 pe-2 sm:ps-6 sm:pe-4">{t("difference")}</TableCell>
              <TableCell className="px-2 text-end sm:px-4">
                <CashDiff diff={counted.countedUsdCents - counted.expectedUsdCents} currency="USD" />
              </TableCell>
              <TableCell className="ps-2 pe-4 text-end sm:ps-4 sm:pe-6">
                <CashDiff diff={counted.countedLbp - counted.expectedLbp} currency="LBP" />
              </TableCell>
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
  );
}
