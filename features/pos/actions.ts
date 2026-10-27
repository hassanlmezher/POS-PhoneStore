"use server";

import { prisma } from "@/lib/db";
import { lockRows } from "@/lib/locks";
import { lbpToUsdCents, toUsdCents } from "@/lib/money";
import { formatTicketNumber, nextSaleNumber, parseTicketNumber } from "@/lib/numbering";
import { phoneSearchDigits } from "@/lib/phone";
import { moveStock } from "@/lib/stock";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { ticketBalance } from "@/features/tickets/money";
import { deviceName } from "@/features/tickets/queries";
import { paymentInput, type PaymentInput } from "@/features/tickets/schema";
import { changeDue, saleBalance, tenderedUsdCents } from "./money";
import { checkoutInput, type CheckoutInput } from "./schema";

export type CheckoutResult =
  | { ok: true; number: number; changeAmount: number; changeCurrency: "USD" | "LBP" | null; balanceUsdCents: number }
  | { ok: false; error: string; detail?: string };

// Payments on a voided sale are ignored everywhere (ticket balances, cash drawer, reports).
const COMPLETED_SALE_ITEMS = { where: { sale: { status: "COMPLETED" as const } } };

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const ctx = await requireActionShop("pos");
  const parsed = checkoutInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;
  const shopId = ctx.shop.id;
  const rate = ctx.shop.exchangeRate;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ---- Resolve lines with database prices ----
      const productIds = v.lines.flatMap((l) => (l.kind === "PRODUCT" ? [l.productId] : []));
      const ticketIds = v.lines.flatMap((l) => (l.kind === "TICKET_BALANCE" ? [l.ticketId] : []));
      // Two tills paying the same repair at once: the second waits here, then sees the first payment.
      await lockRows(tx, "Ticket", shopId, ticketIds);
      const products = await tx.product.findMany({
        where: { shopId, id: { in: productIds }, active: true },
        select: { id: true, name: true, priceUsdCents: true, costUsdCents: true },
      });
      const tickets = await tx.ticket.findMany({
        where: { shopId, id: { in: ticketIds } },
        select: {
          id: true,
          number: true,
          status: true,
          customerId: true,
          estimateUsdCents: true,
          totalUsdCents: true,
          brandText: true,
          modelText: true,
          deviceModel: { select: { name: true, brand: { select: { name: true } } } },
          _count: { select: { items: true } },
          payments: { select: { usdCentsEquivalent: true } },
          saleItems: { ...COMPLETED_SALE_ITEMS, select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true } },
        },
      });
      const productById = new Map(products.map((p) => [p.id, p]));
      const ticketById = new Map(tickets.map((t) => [t.id, t]));

      const items = v.lines.map((l) => {
        if (l.kind === "PRODUCT") {
          const p = productById.get(l.productId);
          if (!p) throw new CheckoutError("productUnavailable");
          const gross = p.priceUsdCents * l.qty;
          if (l.discount > gross) throw new CheckoutError("discountTooLarge", p.name);
          return {
            kind: "PRODUCT" as const,
            productId: p.id,
            ticketId: null,
            description: p.name,
            qty: l.qty,
            unitPriceUsdCents: p.priceUsdCents,
            unitCostUsdCents: p.costUsdCents,
            discountUsdCents: l.discount,
          };
        }
        const t = ticketById.get(l.ticketId);
        if (!t || t.status === "CANCELLED") throw new CheckoutError("ticketUnavailable");
        const label = formatTicketNumber(ctx.shop.ticketPrefix, t.number);
        const balance = ticketBalance(t);
        if (l.amount <= 0 || l.amount > balance) throw new CheckoutError("ticketAmount", label);
        return {
          kind: "TICKET_BALANCE" as const,
          productId: null,
          ticketId: t.id,
          description: `${label} · ${deviceName(t)}`,
          qty: 1,
          unitPriceUsdCents: l.amount,
          unitCostUsdCents: 0, // part costs are counted on the ticket itself
          discountUsdCents: 0,
        };
      });

      // ---- Totals ----
      const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceUsdCents - i.discountUsdCents, 0);
      if (v.cartDiscount > subtotal) throw new CheckoutError("discountTooLarge");
      const total = subtotal - v.cartDiscount;

      const tendered = tenderedUsdCents(v.payments, rate);
      const cashTendered = tenderedUsdCents(
        v.payments.filter((p) => p.method === "CASH"),
        rate,
      );
      // Change can only come out of cash; overpaying by card/transfer is refused.
      if (tendered - total > cashTendered) throw new CheckoutError("overpaidNonCash");
      const changeAmount = changeDue(total, v.payments, v.changeCurrency, rate, ctx.shop.lbpRounding);
      const changeUsd = toUsdCents(changeAmount, v.changeCurrency, rate);
      // Ignore a ±1 cent remainder from LBP→cents rounding (e.g. exact LBP cash).
      const rawBalance = total - (tendered - changeUsd);
      const balance = rawBalance > 1 ? rawBalance : 0;

      // Customer: explicit, or the owner of the (first) repair being paid.
      let customerId = v.customerId;
      if (customerId) {
        const c = await tx.customer.findFirst({ where: { id: customerId, shopId }, select: { id: true } });
        if (!c) throw new CheckoutError("customerNotFound");
      } else {
        customerId = tickets[0]?.customerId ?? null;
      }
      // Unpaid remainder becomes a balance owed, which needs a customer.
      if (balance > 0 && !customerId) throw new CheckoutError("underpaidNoCustomer");

      // ---- Write ----
      const number = await nextSaleNumber(tx, shopId);
      const cashSession = await tx.cashSession.findFirst({ where: { shopId, closedAt: null }, select: { id: true } });
      const sale = await tx.sale.create({
        data: {
          shopId,
          number,
          customerId,
          subtotalUsdCents: subtotal,
          discountUsdCents: v.cartDiscount,
          totalUsdCents: total,
          changeAmount,
          changeCurrency: changeAmount > 0 ? v.changeCurrency : null,
          cashierId: ctx.user.id,
          cashSessionId: cashSession?.id ?? null,
          items: { create: items.map((i) => ({ ...i, shopId })) },
          payments: {
            create: v.payments.map((p) => ({
              shopId,
              method: p.method,
              currency: p.currency,
              amount: p.amount,
              rate,
              usdCentsEquivalent: toUsdCents(p.amount, p.currency, rate),
              reference: p.reference,
              cashSessionId: p.method === "CASH" ? (cashSession?.id ?? null) : null,
              userId: ctx.user.id,
            })),
          },
        },
        select: { id: true },
      });

      for (const i of items) {
        if (i.productId) {
          await moveStock(tx, { shopId, productId: i.productId, delta: -i.qty, reason: "SALE", userId: ctx.user.id, saleId: sale.id });
        }
      }

      for (const l of v.lines) {
        if (l.kind !== "TICKET_BALANCE" || !l.markPickedUp) continue;
        const t = ticketById.get(l.ticketId)!;
        if (t.status === "PICKED_UP") continue;
        await tx.ticket.update({ where: { id: t.id, shopId }, data: { status: "PICKED_UP", pickedUpAt: new Date() } });
        await tx.ticketStatusLog.create({
          data: { shopId, ticketId: t.id, from: t.status, to: "PICKED_UP", userId: ctx.user.id, note: `Sale #${number}` },
        });
      }

      return { number, changeAmount, changeCurrency: changeAmount > 0 ? v.changeCurrency : null, balanceUsdCents: Math.max(0, balance) };
    });
    refreshShop();
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.code, detail: e.detail };
    throw e;
  }
}

class CheckoutError extends Error {
  constructor(
    public code: string,
    public detail?: string,
  ) {
    super(code);
  }
}

/** Owner only. Marks the sale void, returns products to stock, and logs it. */
export async function voidSale(saleId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireActionShop("sales.void");
  const shopId = ctx.shop.id;
  const sale = await ctx.db.sale.findUnique({ where: { id: saleId }, include: { items: true } });
  if (!sale) return { ok: false, error: "notFound" };
  if (sale.status === "VOIDED") return { ok: false, error: "alreadyVoided" };
  if (!reason.trim()) return { ok: false, error: "reasonRequired" };

  const voided = await prisma.$transaction(async (tx) => {
    // Only one of several simultaneous voids (double-click, two owners) flips the status and returns stock.
    const flipped = await tx.sale.updateMany({ where: { id: saleId, shopId, status: "COMPLETED" }, data: { status: "VOIDED" } });
    if (flipped.count === 0) return false;
    for (const i of sale.items) {
      if (i.productId) {
        await moveStock(tx, {
          shopId,
          productId: i.productId,
          delta: i.qty,
          reason: "RETURN",
          userId: ctx.user.id,
          saleId,
          note: `Void sale #${sale.number}`,
        });
      }
    }
    await tx.auditLog.create({
      data: { shopId, userId: ctx.user.id, action: "sale.void", entity: "Sale", entityId: saleId, meta: { reason: reason.trim(), number: sale.number } },
    });
    return true;
  });
  if (!voided) return { ok: false, error: "alreadyVoided" };
  refreshShop();
  return { ok: true };
}

/**
 * Money received later for a sale left unpaid (customer pays what they owe). Recorded, not processed;
 * cash goes to the open drawer. Never more than the balance (LBP may round up by one rounding step).
 */
export async function addSalePayment(saleId: string, input: PaymentInput): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }> {
  const ctx = await requireActionShop("pos");
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  if (typeof saleId !== "string" || !saleId || saleId.length > 64) return { ok: false, error: "invalid" };
  const p = parsed.data;
  const { shop } = ctx;
  return prisma.$transaction(async (tx) => {
    await lockRows(tx, "Sale", shop.id, [saleId]);
    const sale = await tx.sale.findFirst({
      where: { id: saleId, shopId: shop.id },
      select: { status: true, totalUsdCents: true, changeAmount: true, changeCurrency: true, payments: { select: { usdCentsEquivalent: true, rate: true } } },
    });
    if (!sale) return { ok: false as const, error: "notFound" };
    if (sale.status !== "COMPLETED") return { ok: false as const, error: "invalid" };
    const balance = saleBalance(sale);
    if (balance <= 0) return { ok: false as const, error: "alreadyPaid" };
    const usd = toUsdCents(p.amount, p.currency, shop.exchangeRate);
    const slack = p.currency === "LBP" ? lbpToUsdCents(shop.lbpRounding, shop.exchangeRate) + 1 : 0;
    if (usd > balance + slack) return { ok: false as const, error: "moreThanOwed", fieldErrors: { amount: "moreThanOwed" } };
    const cash = p.method === "CASH" ? await tx.cashSession.findFirst({ where: { shopId: shop.id, closedAt: null }, select: { id: true } }) : null;
    await tx.payment.create({
      data: {
        shopId: shop.id,
        saleId,
        method: p.method,
        currency: p.currency,
        amount: p.amount,
        rate: shop.exchangeRate,
        usdCentsEquivalent: Math.min(usd, balance),
        reference: p.reference,
        cashSessionId: cash?.id ?? null,
        userId: ctx.user.id,
      },
    });
    refreshShop();
    return { ok: true as const };
  });
}

/**
 * POS search: an exact barcode/SKU match is returned alone as `exact` (scan → add to cart).
 * Also finds repairs with a balance by ticket number, phone or customer name.
 */
export async function searchPos(q: string) {
  const ctx = await requireActionShop("pos", { write: false });
  const term = q.trim();
  if (!term) return { exact: null, products: [], tickets: [] };

  const exact = await ctx.db.product.findFirst({
    where: { active: true, OR: [{ barcode: term }, { sku: { equals: term, mode: "insensitive" } }] },
    select: { id: true, name: true, sku: true, barcode: true, qty: true, priceUsdCents: true, type: true },
  });
  if (exact) return { exact, products: [exact], tickets: [] };

  const number = parseTicketNumber(term);
  const digits = phoneSearchDigits(term);
  const [products, tickets] = await Promise.all([
    ctx.db.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
          { category: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, sku: true, barcode: true, qty: true, priceUsdCents: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      take: 12,
    }),
    ctx.db.ticket.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [
          ...(number !== null ? [{ number }] : []),
          ...(digits.length >= 3 ? [{ customer: { phone: { contains: digits } } }] : []),
          { customer: { name: { contains: term, mode: "insensitive" as const } } },
        ],
      },
      select: {
        id: true,
        number: true,
        status: true,
        estimateUsdCents: true,
        totalUsdCents: true,
        brandText: true,
        modelText: true,
        deviceModel: { select: { name: true, brand: { select: { name: true } } } },
        customer: { select: { id: true, name: true, phone: true } },
        _count: { select: { items: true } },
        payments: { select: { usdCentsEquivalent: true } },
        saleItems: { ...COMPLETED_SALE_ITEMS, select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    exact: null,
    products,
    tickets: tickets
      .map((t) => ({
        id: t.id,
        number: t.number,
        label: formatTicketNumber(ctx.shop.ticketPrefix, t.number),
        status: t.status,
        device: deviceName(t),
        customer: t.customer,
        balanceUsdCents: ticketBalance(t),
      }))
      .filter((t) => t.balanceUsdCents > 0),
  };
}
export type PosSearchResult = Awaited<ReturnType<typeof searchPos>>;
