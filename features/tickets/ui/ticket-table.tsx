"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TicketStatusValue } from "@/features/tickets/schema";
import { cn } from "@/lib/utils";

/** Compact row data: rendering here (not in the server page) keeps the page payload ~10× smaller per row. */
export type TicketTableRow = {
  id: string;
  number: number;
  label: string;
  device: string;
  customer: string;
  status: TicketStatusValue;
  tech: string | null;
  promised: string | null;
  overdue: boolean;
  balanceUsdCents: number;
  created: string;
};

export function TicketTable({ rows, rate, rounding }: { rows: TicketTableRow[]; rate: number; rounding: number }) {
  const t = useTranslations("tickets");
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t("colTicket")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("colDevice")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("colCustomer")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("colStatus")}</TableHead>
          <TableHead className="hidden lg:table-cell">{t("technician")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("colPromised")}</TableHead>
          <TableHead className="text-end">{t("balance")}</TableHead>
          <TableHead className="hidden xl:table-cell">{t("colCreated")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="relative">
            {/* On phones this cell also shows device, customer and status (their columns are hidden). */}
            <TableCell className="w-full max-w-0 py-2.5 font-semibold whitespace-nowrap md:w-auto md:max-w-none md:py-0">
              <span className="flex items-center gap-2">
                <Link href={`/tickets/${r.number}`} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                  <Ltr>{r.label}</Ltr>
                </Link>
                <StatusBadge status={r.status} className="md:hidden" />
              </span>
              <span className="block truncate font-medium md:hidden">{r.device}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground md:hidden">{r.customer}</span>
            </TableCell>
            <TableCell className="hidden max-w-56 md:table-cell">
              <p className="truncate font-medium">{r.device}</p>
            </TableCell>
            <TableCell className="hidden max-w-48 truncate md:table-cell">{r.customer}</TableCell>
            <TableCell className="hidden md:table-cell">
              <StatusBadge status={r.status} />
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{r.tech ?? t("unassigned")}</TableCell>
            <TableCell className={cn("hidden whitespace-nowrap md:table-cell", r.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
              {r.promised ?? "—"}
            </TableCell>
            <TableCell className="text-end">
              {r.balanceUsdCents > 0 ? (
                <Money usdCents={r.balanceUsdCents} rate={rate} rounding={rounding} className="items-end whitespace-nowrap rtl:items-start" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">{r.created}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
