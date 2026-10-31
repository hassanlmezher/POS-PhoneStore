import { z } from "zod";
import { parseMoney } from "@/lib/money";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const usd = (required: boolean) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) {
        if (required) ctx.addIssue({ code: "custom", message: "required" });
        return 0;
      }
      const n = parseMoney(v, "USD");
      if (n === null) ctx.addIssue({ code: "custom", message: "invalidAmount" });
      return n ?? 0;
    });

export const PRODUCT_TYPES = ["ACCESSORY", "PART", "PHONE"] as const;
export type ProductTypeKey = (typeof PRODUCT_TYPES)[number];

export const productInput = z.object({
  type: z.enum(PRODUCT_TYPES),
  name: z.string().trim().min(1, "required").max(150),
  sku: optionalText(60),
  barcode: optionalText(60),
  category: optionalText(60),
  cost: usd(false),
  price: usd(true),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).default(2),
  active: z.boolean().default(true),
  compatibleModelIds: z.array(z.string()).max(200).default([]),
  /** Only used on create: opening stock, logged as an INITIAL movement. */
  initialQty: z.coerce.number().int().min(0).max(100000).default(0),
});
export type ProductInput = z.input<typeof productInput>;

export const ADJUST_REASONS = ["RESTOCK", "ADJUSTMENT", "DAMAGED", "RETURN"] as const;

export const adjustmentInput = z
  .object({
    delta: z.coerce.number().int().min(-100000).max(100000),
    reason: z.enum(ADJUST_REASONS),
    note: optionalText(300),
  })
  .refine((v) => v.delta !== 0, { path: ["delta"], message: "nonZero" })
  // Restock adds and damaged removes; the sign is enforced so reports stay meaningful.
  .refine((v) => v.reason !== "RESTOCK" || v.delta > 0, { path: ["delta"], message: "mustBePositive" })
  .refine((v) => v.reason !== "DAMAGED" || v.delta < 0, { path: ["delta"], message: "mustBeNegative" });
export type AdjustmentInput = z.input<typeof adjustmentInput>;
