import { z } from "zod";
import { RESERVED_SLUGS, isValidSlug } from "@/lib/hosts";
import { parseMoney } from "@/lib/money";


export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => isValidSlug(v), "invalidSlug")
  .refine((v) => !RESERVED_SLUGS.includes(v), "reservedSlug");

const date = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "invalidDate");

export const createShopInput = z.object({
  name: z.string().trim().min(1, "required").max(100),
  slug: slugSchema,
  planId: z.string().optional().transform((v) => v || null),
  trialDays: z.coerce.number().int().min(0).max(365).default(14),
  defaultLocale: z.enum(["EN", "AR"]).default("EN"),
  ownerName: z.string().trim().min(1, "required").max(100),
  ownerEmail: z.string().trim().toLowerCase().email("invalidEmail"),
  ownerPassword: z.string().min(8, "passwordTooShort").max(128),
});
export type CreateShopInput = z.input<typeof createShopInput>;

export const updateSubscriptionInput = z.object({
  planId: z.string().optional().transform((v) => v || null),
  subscriptionStatus: z.enum(["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED"]),
  trialEndsAt: date,
  paidUntil: date,
});
export type UpdateSubscriptionInput = z.input<typeof updateSubscriptionInput>;

export const subscriptionPaymentInput = z
  .object({
    amount: z.string().trim().min(1, "required"),
    method: z.string().trim().min(1, "required").max(40), // cash, Whish, OMT, transfer…
    periodStart: z.string().min(1, "required"),
    periodEnd: z.string().min(1, "required"),
    note: z.string().trim().max(300).optional(),
  })
  .transform((v, ctx) => {
    const amountUsdCents = parseMoney(v.amount, "USD");
    const periodStart = new Date(v.periodStart);
    const periodEnd = new Date(v.periodEnd);
    if (amountUsdCents === null) ctx.addIssue({ code: "custom", path: ["amount"], message: "invalidAmount" });
    if (Number.isNaN(periodStart.getTime())) ctx.addIssue({ code: "custom", path: ["periodStart"], message: "invalidDate" });
    if (Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart) {
      ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "invalidDate" });
    }
    return { amountUsdCents: amountUsdCents ?? 0, method: v.method, periodStart, periodEnd, note: v.note || null };
  });
export type SubscriptionPaymentInput = z.input<typeof subscriptionPaymentInput>;

export const planInput = z.object({
  name: z.string().trim().min(1, "required").max(60),
  price: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = parseMoney(v, "USD");
      if (n === null) ctx.addIssue({ code: "custom", message: "invalidAmount" });
      return n ?? 0;
    }),
  maxStaff: z.coerce.number().int().min(1).max(1000).optional().or(z.literal("").transform(() => undefined)),
  active: z.boolean().default(true),
});
export type PlanInput = z.input<typeof planInput>;
