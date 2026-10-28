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

export const partOrderInput = z
  .object({
    part: z.string().trim().min(1, "required").max(120),
    qty: z.coerce.number().int().min(1, "invalidQty").max(99, "invalidQty"),
    supplierName: z.string().trim().min(1, "required").max(80),
    supplierPhone: optionalText(40),
    /** Local day "YYYY-MM-DD". */
    expectedDay: z.string().refine(isDayKey, "invalidDate"),
    cost: optionalText(20),
    note: optionalText(300),
  })
  .transform((v, ctx) => {
    let costUsdCents: number | null = null;
    if (v.cost) {
      costUsdCents = parseMoney(v.cost, "USD");
      if (costUsdCents === null) {
        ctx.addIssue({ code: "custom", path: ["cost"], message: "invalidAmount" });
        return z.NEVER;
      }
    }
    return { ...v, costUsdCents };
  });
export type PartOrderInput = z.input<typeof partOrderInput>;

/** Ticket statuses that move to "Waiting for part" when a part is ordered. */
export const BEFORE_WAITING = ["RECEIVED", "DIAGNOSING", "REPAIRING"] as const;
