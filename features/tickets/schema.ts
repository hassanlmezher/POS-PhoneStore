import { z } from "zod";
import { parseMoney } from "@/lib/money";

/** Android pattern: 4–9 distinct dots, e.g. "1-5-9-8" (1 = top-left, 9 = bottom-right). */
export function isValidPattern(v: string): boolean {
  if (!/^[1-9](-[1-9]){3,8}$/.test(v)) return false;
  const dots = v.split("-");
  return new Set(dots).size === dots.length;
}

export const TICKET_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "WAITING_PART",
  "REPAIRING",
  "READY",
  "PICKED_UP",
  "CANCELLED",
  "CANT_FIX",
] as const;
export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

/** Board columns in order; closed statuses are grouped in the last column. */
export const OPEN_STATUSES = ["RECEIVED", "DIAGNOSING", "WAITING_PART", "REPAIRING", "READY"] as const;
export const CLOSED_STATUSES = ["PICKED_UP", "CANCELLED", "CANT_FIX"] as const;

export const ACCESSORIES = ["SIM", "CASE", "CHARGER", "MEMORY_CARD", "BOX", "OTHER"] as const;
export const PAYMENT_METHODS = ["CASH", "WHISH", "OMT", "CARD", "BANK_TRANSFER"] as const;
export const CURRENCIES = ["USD", "LBP"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

/** Money typed by the user as text ("25", "12.50", "1,500,000"). Empty → null. */
const moneyText = (currency: "USD" | "LBP" = "USD") =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = parseMoney(v, currency);
      if (n === null) ctx.addIssue({ code: "custom", message: "invalidAmount" });
      return n;
    });

export const paymentInput = z
  .object({
    amount: z.string().trim().min(1, "required"),
    currency: z.enum(CURRENCIES),
    method: z.enum(PAYMENT_METHODS),
    reference: optionalText(100),
  })
  .transform((v, ctx) => {
    const amount = parseMoney(v.amount, v.currency);
    if (amount === null || amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { ...v, amount };
  });
export type PaymentInput = z.input<typeof paymentInput>;

export const newCustomerInline = z.object({
  name: z.string().trim().min(1, "required").max(100),
  phone: z.string().trim().min(1, "required"),
  locale: z.enum(["EN", "AR"]).default("EN"),
});

export const ticketInput = z
  .object({
    customerId: z.string().optional(),
    newCustomer: newCustomerInline.optional(),
    deviceModelId: z.string().optional().transform((v) => v || null),
    brandText: optionalText(60),
    modelText: optionalText(80),
    imei: optionalText(40),
    color: optionalText(40),
    problem: z.string().trim().min(1, "required").max(2000),
    passcode: optionalText(100),
    pattern: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || isValidPattern(v), "patternTooShort"),
    accessories: z.array(z.enum(ACCESSORIES)).default([]),
    conditionNotes: optionalText(1000),
    estimate: moneyText("USD"),
    deposit: paymentInput.optional(),
    promisedAt: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : null))
      .refine((d) => d === null || !Number.isNaN(d.getTime()), "invalidDate"),
    assignedToId: z.string().optional().transform((v) => v || null),
    warrantyDays: z.coerce.number().int().min(0).max(3650).optional(),
  })
  .refine((v) => v.customerId || v.newCustomer, { path: ["customerId"], message: "required" })
  .refine((v) => v.deviceModelId || v.modelText, { path: ["deviceModelId"], message: "required" });
export type TicketInput = z.input<typeof ticketInput>;

export const ticketDetailsInput = z.object({
  imei: optionalText(40),
  color: optionalText(40),
  problem: z.string().trim().min(1, "required").max(2000),
  conditionNotes: optionalText(1000),
  accessories: z.array(z.enum(ACCESSORIES)).default([]),
  estimate: moneyText("USD"),
  promisedAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  warrantyDays: z.coerce.number().int().min(0).max(3650),
});
export type TicketDetailsInput = z.input<typeof ticketDetailsInput>;

export const ticketItemInput = z
  .object({
    kind: z.enum(["PART", "LABOR"]),
    productId: z.string().optional().transform((v) => v || null),
    description: z.string().trim().min(1, "required").max(200),
    qty: z.coerce.number().int().min(1).max(999).default(1),
    unitPrice: z.string().trim().min(1, "required"),
  })
  .transform((v, ctx) => {
    const unitPriceUsdCents = parseMoney(v.unitPrice, "USD");
    if (unitPriceUsdCents === null) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { ...v, unitPriceUsdCents };
  });
export type TicketItemInput = z.input<typeof ticketItemInput>;
