import "server-only";
import { saleBalance } from "@/features/pos/money";
import { ticketBalance, ticketPaid } from "@/features/tickets/money";
import type { Prisma } from "@/lib/generated/prisma/client";

export const saleMoneySelect = {
  totalUsdCents: true,
  status: true,
  changeAmount: true,
  changeCurrency: true,
  payments: { select: { usdCentsEquivalent: true, rate: true } },
} satisfies Prisma.SaleSelect;

export const ticketMoneySelect = {
  status: true,
  estimateUsdCents: true,
  totalUsdCents: true,
  _count: { select: { items: true } },
  payments: { select: { usdCentsEquivalent: true } },
  saleItems: { where: { sale: { status: "COMPLETED" } }, select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true } },
} satisfies Prisma.TicketSelect;

type SaleMoney = Prisma.SaleGetPayload<{ select: typeof saleMoneySelect }>;
type TicketMoney = Prisma.TicketGetPayload<{ select: typeof ticketMoneySelect }>;

/** Paid so far and still owed (USD cents) on a sale or a repair; nothing is owed on voided/cancelled ones. */
export function saleOwed(s: SaleMoney) {
  const balance = s.status === "VOIDED" ? 0 : Math.max(0, saleBalance(s));
  return { paidUsdCents: s.totalUsdCents - saleBalance(s), balanceUsdCents: balance };
}
export function ticketOwed(t: TicketMoney) {
  return { paidUsdCents: ticketPaid(t), balanceUsdCents: t.status === "CANCELLED" ? 0 : Math.max(0, ticketBalance(t)) };
}

/** What is owed on one sale or repair, read inside a transaction. */
export async function owedOn(tx: Prisma.TransactionClient, shopId: string, kind: "sale" | "ticket", id: string, ticketWhere?: Prisma.TicketWhereInput) {
  if (kind === "sale") {
    const s = await tx.sale.findFirst({ where: { id, shopId }, select: { customerId: true, ...saleMoneySelect } });
    return s ? { customerId: s.customerId, ...saleOwed(s) } : null;
  }
  const t = await tx.ticket.findFirst({ where: { AND: [{ id, shopId }, ticketWhere ?? {}] }, select: { customerId: true, ...ticketMoneySelect } });
  return t ? { customerId: t.customerId, ...ticketOwed(t) } : null;
}
