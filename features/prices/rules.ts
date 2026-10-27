import { z } from "zod";
import { parseMoney } from "@/lib/money";

/** "Change all prices" rounding steps, in USD cents (0 = keep cents). */
export const ROUND_STEPS = [0, 100, 500] as const;

/** New price after a % change, rounded to the step; never below one step (or 1 cent). */
export function adjustPrice(cents: number, percent: number, step: number): number {
  const raw = (cents * (100 + percent)) / 100;
  const rounded = step > 0 ? Math.round(raw / step) * step : Math.round(raw);
  return Math.max(step || 1, rounded);
}

export const priceInput = z
  .object({
    /** Empty = the price for any model. */
    deviceModelId: z
      .string()
      .max(64)
      .optional()
      .transform((v) => v || null),
    service: z.string().trim().min(1, "required").max(60),
    price: z.string().trim().min(1, "required"),
  })
  .transform((v, ctx) => {
    const n = parseMoney(v.price, "USD");
    if (n === null || n <= 0) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { deviceModelId: v.deviceModelId, service: v.service, priceUsdCents: n };
  });
export type PriceInput = z.input<typeof priceInput>;

export const adjustInput = z.object({
  percent: z.number().int().min(-90).max(500).refine((n) => n !== 0, "nonZero"),
  step: z.number().refine((n) => (ROUND_STEPS as readonly number[]).includes(n), "invalid"),
  /** Only this service (case-insensitive); empty = every price. */
  service: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || null),
});
export type AdjustInput = z.input<typeof adjustInput>;
