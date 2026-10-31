import { z } from "zod";
import { isDayKey } from "@/lib/dates";
import { parseMoney } from "@/lib/money";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const PAY_METHODS = ["CASH", "WHISH", "OMT", "CARD", "BANK_TRANSFER"] as const;

export const supplierInput = z.object({
  name: z.string().trim().min(1, "required").max(80),
  phone: optionalText(40),
  note: optionalText(300),
});
export type SupplierInput = z.input<typeof supplierInput>;

/** A payment to a supplier: amount in USD or LBP. */
export const payInput = z
  .object({
    amount: z.string().trim().min(1, "required"),
    currency: z.enum(["USD", "LBP"]),
    method: z.enum(PAY_METHODS),
    day: z.string().refine(isDayKey, "invalidDate"),
    note: optionalText(300),
    /** Cash only: also take it out of the open drawer (or put it in, for money back). */
    fromDrawer: z.boolean().optional(),
    /** Money the supplier gives back (when they owe the shop): stored as a negative payment. */
    refund: z.boolean().optional(),
  })
  .transform((v, ctx) => {
    const amount = parseMoney(v.amount, v.currency);
    if (amount === null || amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { ...v, amount, fromDrawer: v.method === "CASH" && !!v.fromDrawer, refund: !!v.refund };
  });
export type PayInput = z.input<typeof payInput>;

/** A product that is not in stock yet, created by the purchase (cost and quantity come from the line). */
const newProductInput = z
  .object({
    type: z.enum(["ACCESSORY", "PART"]),
    name: z.string().trim().min(1, "required").max(150),
    category: optionalText(60),
    barcode: optionalText(60),
    price: z.string().trim().min(1, "required"),
  })
  .transform((v, ctx) => {
    const price = parseMoney(v.price, "USD");
    if (price === null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { type: v.type, name: v.name, category: v.category, barcode: v.barcode, priceUsdCents: price };
  });

export const purchaseInput = z.object({
  supplierId: z.string().min(1).max(64),
  day: z.string().refine(isDayKey, "invalidDate"),
  reference: optionalText(60),
  note: optionalText(300),
  items: z
    .array(
      z
        .object({
          /** An existing product, or `newProduct` to create it with this purchase. */
          productId: z.string().min(1).max(64).optional(),
          newProduct: newProductInput.optional(),
          qty: z.coerce.number().int().min(1, "invalidQty").max(9999, "invalidQty"),
          unitCost: z.string().trim().min(1, "required"),
        })
        .transform((v, ctx) => {
          const c = parseMoney(v.unitCost, "USD");
          if (c === null) {
            ctx.addIssue({ code: "custom", path: ["unitCost"], message: "invalidAmount" });
            return z.NEVER;
          }
          if (!v.productId && !v.newProduct) {
            ctx.addIssue({ code: "custom", path: ["productId"], message: "required" });
            return z.NEVER;
          }
          return { productId: v.productId ?? null, newProduct: v.productId ? null : (v.newProduct ?? null), qty: v.qty, unitCostUsdCents: c };
        }),
    )
    .min(1, "noItems")
    .max(100),
  /** Paid at the time of the purchase (optional); the rest is owed. */
  paid: payInput.optional(),
});
export type PurchaseInput = z.input<typeof purchaseInput>;

/** New average cost after buying `qty` more at `unit` (negative stock counts as zero). */
export function averageCost(oldQty: number, oldCost: number, qty: number, unit: number): number {
  const have = Math.max(0, oldQty);
  return have + qty > 0 ? Math.round((have * oldCost + qty * unit) / (have + qty)) : unit;
}

/** Suggested quantity to order for a low-stock product: back up to twice its alert level. */
export const suggestQty = (qty: number, threshold: number) => Math.max(1, threshold * 2 - Math.max(0, qty));
