// Ticket money rules (pure; safe for server and client).
//   charge  = sum of parts + labor if any were added, otherwise the estimate
//   paid    = payments on the ticket (deposits) + ticket balance lines paid at the POS
//   balance = charge − paid

type TicketMoneyInput = {
  estimateUsdCents: number | null;
  totalUsdCents: number;
  _count?: { items: number };
  items?: unknown[];
  payments: { usdCentsEquivalent: number }[];
  saleItems?: { qty: number; unitPriceUsdCents: number; discountUsdCents: number }[];
};

export function ticketCharge(t: TicketMoneyInput): number {
  const itemCount = t._count?.items ?? t.items?.length ?? 0;
  return itemCount > 0 ? t.totalUsdCents : (t.estimateUsdCents ?? 0);
}

export function ticketPaid(t: TicketMoneyInput): number {
  const deposits = t.payments.reduce((s, p) => s + p.usdCentsEquivalent, 0);
  const posLines = (t.saleItems ?? []).reduce((s, i) => s + i.qty * i.unitPriceUsdCents - i.discountUsdCents, 0);
  return deposits + posLines;
}

export function ticketBalance(t: TicketMoneyInput): number {
  return ticketCharge(t) - ticketPaid(t);
}

/** Warranty end date, or null if the phone wasn't picked up yet. */
export function warrantyUntil(t: { pickedUpAt: Date | null; warrantyDays: number }): Date | null {
  if (!t.pickedUpAt || t.warrantyDays <= 0) return null;
  return new Date(t.pickedUpAt.getTime() + t.warrantyDays * 86_400_000);
}
