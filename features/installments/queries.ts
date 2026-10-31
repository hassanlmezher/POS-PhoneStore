import "server-only";
import { getFormatter, getTranslations } from "next-intl/server";
import { deviceName, ticketAccessWhere } from "@/features/tickets/queries";
import { dayKey } from "@/lib/dates";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { phoneSearchDigits } from "@/lib/phone";
import type { ShopContext } from "@/lib/tenant";
import { waLink } from "@/lib/whatsapp";
import { saleMoneySelect, saleOwed, ticketMoneySelect, ticketOwed } from "./owed";
import { partStates } from "./rules";

const select = {
  id: true,
  totalUsdCents: true,
  paidBeforeUsdCents: true,
  note: true,
  createdAt: true,
  customer: { select: { id: true, name: true, phone: true, locale: true } },
  sale: { select: { id: true, number: true, ...saleMoneySelect } },
  ticket: {
    select: {
      id: true,
      number: true,
      brandText: true,
      modelText: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
      ...ticketMoneySelect,
    },
  },
  parts: { select: { id: true, number: true, dueAt: true, amountUsdCents: true, remindedAt: true }, orderBy: { number: "asc" } },
} satisfies Prisma.InstallmentPlanSelect;
type PlanData = Prisma.InstallmentPlanGetPayload<{ select: typeof select }>;

/** Plans with every part's state and a WhatsApp reminder for the next part to pay. Cancelled/voided ones are left out. */
async function toRows(ctx: ShopContext, plans: PlanData[]) {
  const { shop } = ctx;
  const tz = shop.timezone;
  const today = dayKey(new Date(), tz);
  const tr = {
    en: { t: await getTranslations({ locale: "en", namespace: "installments" }), f: await getFormatter({ locale: "en" }) },
    ar: { t: await getTranslations({ locale: "ar", namespace: "installments" }), f: await getFormatter({ locale: "ar" }) },
  };
  const both = (usd: number) => `${formatMoney(usd, "USD")} (${formatMoney(toLbp(usd, shop.exchangeRate, shop.lbpRounding), "LBP")})`;

  return plans.flatMap((p) => {
    const money = p.sale ? saleOwed(p.sale) : p.ticket ? ticketOwed(p.ticket) : null;
    if (!money || (p.sale?.status === "VOIDED") || p.ticket?.status === "CANCELLED") return [];
    const kind = p.sale ? ("sale" as const) : ("ticket" as const);
    const locale = p.customer.locale === "AR" ? "ar" : "en";
    const { t, f } = tr[locale];
    const what = p.sale ? t("waSale", { number: p.sale.number }) : t("waRepair", { device: deviceName(p.ticket!), ticket: formatTicketNumber(shop.ticketPrefix, p.ticket!.number) });
    const parts = partStates(
      p.parts.map((x) => ({ id: x.id, number: x.number, dueDay: dayKey(x.dueAt, tz), dueAt: x.dueAt, amountUsdCents: x.amountUsdCents, reminded: !!x.remindedAt })),
      money.paidUsdCents - p.paidBeforeUsdCents,
      today,
    );
    const next = parts.find((x) => x.state !== "paid") ?? null;
    const done = money.balanceUsdCents <= 0 || !next;
    const reminder =
      next && !done && p.customer.phone
        ? waLink(
            p.customer.phone,
            t(next.state === "late" ? "waLate" : "waDue", {
              customer: p.customer.name,
              shop: shop.name,
              part: next.number,
              count: parts.length,
              what,
              amount: both(next.owedUsdCents),
              date: f.dateTime(next.dueAt, { weekday: "long", day: "numeric", month: "long", timeZone: tz }),
              left: both(money.balanceUsdCents),
            }),
          )
        : null;
    return [
      {
        id: p.id,
        kind,
        targetId: (p.sale?.id ?? p.ticket?.id)!,
        /** Sale number, or the repair's ticket label. */
        number: p.sale?.number ?? p.ticket!.number,
        label: p.sale ? `#${p.sale.number}` : formatTicketNumber(shop.ticketPrefix, p.ticket!.number),
        href: p.sale ? `/sales/${p.sale.number}` : `/tickets/${p.ticket!.number}`,
        detail: p.ticket ? deviceName(p.ticket) : null,
        customer: { id: p.customer.id, name: p.customer.name, phone: p.customer.phone },
        totalUsdCents: p.totalUsdCents,
        owedUsdCents: money.balanceUsdCents,
        done,
        paidParts: parts.filter((x) => x.state === "paid").length,
        parts: parts.map((x) => ({ id: x.id, number: x.number, dueDay: x.dueDay, amountUsdCents: x.amountUsdCents, owedUsdCents: x.owedUsdCents, state: x.state, reminded: x.reminded })),
        next: next && !done ? { id: next.id, number: next.number, dueDay: next.dueDay, owedUsdCents: Math.min(next.owedUsdCents, money.balanceUsdCents), state: next.state, reminded: next.reminded } : null,
        reminder,
        note: p.note,
      },
    ];
  });
}
export type PlanRow = Awaited<ReturnType<typeof toRows>>[number];

/** Search by customer name, phone, ticket label or sale number. */
export function matchPlan(p: PlanRow, q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const digits = phoneSearchDigits(term);
  return (
    p.customer.name.toLowerCase().includes(term) ||
    p.label.toLowerCase().includes(term) ||
    String(p.number) === term.replace(/^#/, "") ||
    (digits.length >= 3 && !!p.customer.phone && p.customer.phone.replace(/\D/g, "").includes(digits))
  );
}

/** Plans the user may see (technicians: their repairs only). */
function visible(ctx: ShopContext): Prisma.InstallmentPlanWhereInput {
  return ctx.user.role === "TECHNICIAN" ? { ticket: ticketAccessWhere(ctx.user) } : {};
}

/** Every plan still being paid, the most urgent first (late, then due soon, then by next day). */
export async function listPlans(ctx: ShopContext) {
  const plans = await ctx.db.installmentPlan.findMany({ where: visible(ctx), select, orderBy: { createdAt: "desc" }, take: 500 });
  const rank = { late: 0, today: 1, dueSoon: 1, partial: 2, later: 2, paid: 3 } as const;
  return (await toRows(ctx, plans)).sort(
    (a, b) => Number(a.done) - Number(b.done) || rank[a.next?.state ?? "paid"] - rank[b.next?.state ?? "paid"] || (a.next?.dueDay ?? "").localeCompare(b.next?.dueDay ?? ""),
  );
}

/** Plans of one customer, keyed by "sale:<id>" / "ticket:<id>". */
export async function customerPlans(ctx: ShopContext, customerId: string) {
  const plans = await ctx.db.installmentPlan.findMany({ where: { AND: [{ customerId }, visible(ctx)] }, select });
  return new Map((await toRows(ctx, plans)).map((r) => [`${r.kind}:${r.targetId}`, r]));
}

/** How many plans have a part late or due in the next days (for the Customers button). */
export async function countDuePlans(ctx: ShopContext) {
  return (await listPlans(ctx)).filter((p) => p.next && ["late", "today", "dueSoon"].includes(p.next.state)).length;
}
