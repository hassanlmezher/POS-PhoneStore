import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Atomically reserve the next ticket number for a shop. Call inside a transaction. */
export async function nextTicketNumber(tx: Prisma.TransactionClient, shopId: string): Promise<number> {
  const shop = await tx.shop.update({
    where: { id: shopId },
    data: { ticketSeq: { increment: 1 } },
    select: { ticketSeq: true },
  });
  return shop.ticketSeq;
}

/** Atomically reserve the next sale number for a shop. Call inside a transaction. */
export async function nextSaleNumber(tx: Prisma.TransactionClient, shopId: string): Promise<number> {
  const shop = await tx.shop.update({
    where: { id: shopId },
    data: { saleSeq: { increment: 1 } },
    select: { saleSeq: true },
  });
  return shop.saleSeq;
}

export function formatTicketNumber(prefix: string, number: number): string {
  return `${prefix}${number}`;
}

/** Parses "R-1042", "r1042" or "1042" into 1042. */
export function parseTicketNumber(input: string): number | null {
  const m = input.trim().match(/^(?:[a-z]+-?)?(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
}
