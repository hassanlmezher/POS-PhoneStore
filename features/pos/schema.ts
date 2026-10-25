import { z } from "zod";
import { parseMoney } from "@/lib/money";
import { CURRENCIES, PAYMENT_METHODS } from "@/features/tickets/schema";

const usdText = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return 0;
    const n = parseMoney(v, "USD");
    if (n === null) ctx.addIssue({ code: "custom", message: "invalidAmount" });
    return n ?? 0;
  });

// Prices come from the database, never from the client; the client only sends
// quantities, discounts and (for repairs) how much of the balance to pay.
export const cartLine = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("PRODUCT"),
    productId: z.string().min(1),
    qty: z.coerce.number().int().min(1).max(9999),
    discount: usdText, // USD cents off the whole line
  }),
  z.object({
    kind: z.literal("TICKET_BALANCE"),
    ticketId: z.string().min(1),
    amount: usdText, // USD cents to pay towards the ticket balance
    markPickedUp: z.boolean().default(false),
  }),
]);

export const salePayment = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    currency: z.enum(CURRENCIES),
    amount: z.string().trim().min(1, "required"),
    reference: z.string().trim().max(100).optional(),
  })
  .transform((v, ctx) => {
    const amount = parseMoney(v.amount, v.currency);
    if (amount === null || amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { ...v, amount, reference: v.reference || null };
  });

export const checkoutInput = z.object({
  customerId: z.string().optional().transform((v) => v || null),
  lines: z.array(cartLine).min(1, "emptyCart").max(200),
  cartDiscount: usdText,
  payments: z.array(salePayment).max(10).default([]),
  /** Currency the change is handed back in. */
  changeCurrency: z.enum(CURRENCIES).default("USD"),
});
export type CheckoutInput = z.input<typeof checkoutInput>;
