import { z } from "zod";
import { isDayKey } from "@/lib/dates";
import { parseMoney } from "@/lib/money";

export const EXPENSE_CATEGORIES = ["RENT", "GENERATOR", "ELECTRICITY", "SALARIES", "INTERNET", "SUPPLIES", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseInput = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    currency: z.enum(["USD", "LBP"]),
    amount: z.string().trim().min(1, "required"),
    /** Local shop day "YYYY-MM-DD". */
    day: z.string().refine(isDayKey, "invalidDate"),
    note: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => v || null),
    /** New expenses only: also take it out of the open cash drawer. */
    fromDrawer: z.boolean().optional(),
  })
  .transform((v, ctx) => {
    const n = parseMoney(v.amount, v.currency);
    if (n === null || n <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { ...v, amount: n };
  });
export type ExpenseInput = z.input<typeof expenseInput>;
