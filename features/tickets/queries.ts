import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseTicketNumber } from "@/lib/numbering";
import { phoneSearchDigits } from "@/lib/phone";
import type { ShopContext } from "@/lib/tenant";
import { ticketBalance, ticketCharge, ticketPaid, warrantyUntil } from "./money";
import { CLOSED_STATUSES, type TicketStatusValue } from "./schema";

/** Technicians only see tickets assigned to them or unassigned. */
export function ticketAccessWhere(user: ShopContext["user"]): Prisma.TicketWhereInput {
  if (user.role !== "TECHNICIAN") return {};
  return { OR: [{ assignedToId: user.id }, { assignedToId: null }] };
}

export function ticketSearchWhere(q: string): Prisma.TicketWhereInput {
  const term = q.trim();
  if (!term) return {};
  const or: Prisma.TicketWhereInput[] = [
    { imei: { contains: term, mode: "insensitive" } },
    { customer: { name: { contains: term, mode: "insensitive" } } },
    { modelText: { contains: term, mode: "insensitive" } },
    { deviceModel: { name: { contains: term, mode: "insensitive" } } },
  ];
  const number = parseTicketNumber(term);
  if (number !== null) or.push({ number });
  const digits = phoneSearchDigits(term);
  if (digits.length >= 3) or.push({ customer: { phone: { contains: digits } } });
  return { OR: or };
}

/** Fields needed for cards and table rows. */
export const ticketCardSelect = {
  id: true,
  number: true,
  status: true,
  problem: true,
  brandText: true,
  modelText: true,
  imei: true,
  promisedAt: true,
  createdAt: true,
  updatedAt: true,
  estimateUsdCents: true,
  totalUsdCents: true,
  customer: { select: { id: true, name: true, phone: true, locale: true } },
  deviceModel: { select: { name: true, brand: { select: { name: true } } } },
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { items: true } },
  payments: { select: { usdCentsEquivalent: true } },
  saleItems: { where: { sale: { status: "COMPLETED" } }, select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true } },
} satisfies Prisma.TicketSelect;

type CardRow = Prisma.TicketGetPayload<{ select: typeof ticketCardSelect }>;

export function deviceName(t: {
  brandText: string | null;
  modelText: string | null;
  deviceModel: { name: string; brand: { name: string } } | null;
}): string {
  if (t.deviceModel) return `${t.deviceModel.brand.name} ${t.deviceModel.name}`;
  return [t.brandText, t.modelText].filter(Boolean).join(" ");
}

function toCard(t: CardRow) {
  const { payments, saleItems, _count, ...rest } = t;
  void payments;
  void saleItems;
  void _count;
  return { ...rest, device: deviceName(t), balanceUsdCents: ticketBalance(t), chargeUsdCents: ticketCharge(t) };
}
export type TicketCard = ReturnType<typeof toCard>;

export type TicketFilters = {
  q?: string;
  status?: TicketStatusValue[];
  assignedToId?: string;
  page?: number;
};

export const TICKETS_PAGE_SIZE = 30;

export async function listTickets(ctx: ShopContext, f: TicketFilters) {
  const where: Prisma.TicketWhereInput = {
    AND: [
      ticketAccessWhere(ctx.user),
      ticketSearchWhere(f.q ?? ""),
      f.status?.length ? { status: { in: f.status } } : {},
      f.assignedToId === "none" ? { assignedToId: null } : f.assignedToId ? { assignedToId: f.assignedToId } : {},
    ],
  };
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    ctx.db.ticket.findMany({
      where,
      select: ticketCardSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * TICKETS_PAGE_SIZE,
      take: TICKETS_PAGE_SIZE,
    }),
    ctx.db.ticket.count({ where }),
  ]);
  return { rows: rows.map(toCard), total, page, pageSize: TICKETS_PAGE_SIZE };
}

/** Kanban: every open ticket, plus tickets closed in the last 3 days. */
export async function boardTickets(ctx: ShopContext, q = "") {
  const since = new Date(Date.now() - 3 * 86_400_000);
  const rows = await ctx.db.ticket.findMany({
    where: {
      AND: [
        ticketAccessWhere(ctx.user),
        ticketSearchWhere(q),
        { OR: [{ status: { notIn: [...CLOSED_STATUSES] } }, { updatedAt: { gte: since } }] },
      ],
    },
    select: ticketCardSelect,
    orderBy: [{ promisedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 500,
  });
  return rows.map(toCard);
}

export async function getTicketByNumber(ctx: ShopContext, number: number) {
  const t = await ctx.db.ticket.findFirst({
    where: { AND: [{ number }, ticketAccessWhere(ctx.user)] },
    include: {
      customer: true,
      deviceModel: { include: { brand: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" }, include: { product: { select: { id: true, name: true, qty: true } } } },
      statusLogs: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
      saleItems: {
        where: { sale: { status: "COMPLETED" } },
        select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true, saleId: true },
      },
    },
  });
  if (!t) return null;
  const { passcodeEnc, patternEnc, ...safe } = t;
  return {
    ...safe,
    device: deviceName(t),
    hasPasscode: !!passcodeEnc,
    hasPattern: !!patternEnc,
    chargeUsdCents: ticketCharge(t),
    paidUsdCents: ticketPaid(t),
    balanceUsdCents: ticketBalance(t),
    warrantyUntil: warrantyUntil(t),
  };
}
export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketByNumber>>>;

/** Owners and technicians who can be assigned repairs. */
export async function listTechnicians(shopId: string) {
  return prisma.user.findMany({
    where: { shopId, active: true, role: { in: ["OWNER", "TECHNICIAN"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

/** Global + shop-specific brands/models, small enough to filter client-side. */
export async function getDeviceCatalog(shopId: string) {
  const brands = await prisma.deviceBrand.findMany({
    where: { OR: [{ shopId: null }, { shopId }] },
    select: {
      id: true,
      name: true,
      models: {
        where: { OR: [{ shopId: null }, { shopId }] },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  return brands;
}
export type DeviceCatalog = Awaited<ReturnType<typeof getDeviceCatalog>>;
