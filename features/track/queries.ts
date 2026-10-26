import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatTicketNumber } from "@/lib/numbering";
import { ticketBalance, ticketCharge, ticketPaid, warrantyUntil } from "@/features/tickets/money";
import { deviceName } from "@/features/tickets/queries";

export type TrackTicket = {
  label: string;
  status: string;
  device: string;
  receivedAt: Date;
  promisedAt: Date | null;
  pickedUpAt: Date | null;
  warrantyUntil: Date | null;
  chargeUsdCents: number;
  paidUsdCents: number;
  balanceUsdCents: number;
  /** Status changes only: no staff names, notes or prices. */
  timeline: { status: string; at: Date }[];
};

const trackSelect = {
  number: true,
  status: true,
  createdAt: true,
  promisedAt: true,
  pickedUpAt: true,
  warrantyDays: true,
  estimateUsdCents: true,
  totalUsdCents: true,
  brandText: true,
  modelText: true,
  deviceModel: { select: { name: true, brand: { select: { name: true } } } },
  _count: { select: { items: true } },
  payments: { select: { usdCentsEquivalent: true } },
  saleItems: {
    where: { sale: { status: "COMPLETED" } },
    select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true },
  },
  statusLogs: { select: { to: true, createdAt: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.TicketSelect;

/** The public view of one ticket (used by the phone lookup and the direct link). */
export async function findTrackTicket(ticketPrefix: string, where: Prisma.TicketWhereInput): Promise<TrackTicket | null> {
  const t = await prisma.ticket.findFirst({ where, select: trackSelect });
  if (!t) return null;
  return {
    label: formatTicketNumber(ticketPrefix, t.number),
    status: t.status,
    device: deviceName(t),
    receivedAt: t.createdAt,
    promisedAt: t.promisedAt,
    pickedUpAt: t.pickedUpAt,
    warrantyUntil: warrantyUntil(t),
    chargeUsdCents: ticketCharge(t),
    paidUsdCents: ticketPaid(t),
    balanceUsdCents: Math.max(0, ticketBalance(t)),
    timeline: t.statusLogs.map((l) => ({ status: l.to, at: l.createdAt })),
  };
}
