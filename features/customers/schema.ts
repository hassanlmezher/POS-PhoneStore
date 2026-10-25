import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const phone = (countryCode: string) => z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v, countryCode);
    if (!n) ctx.addIssue({ code: "custom", message: "invalidPhone" });
    return n ?? "";
  });

const optionalPhone = (countryCode: string) => z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizePhone(v, countryCode);
    if (!n) ctx.addIssue({ code: "custom", message: "invalidPhone" });
    return n;
  });

/** Customer form schema; phones are normalized with the shop's country code. */
export const customerInput = (countryCode: string) => z.object({
  name: z.string().trim().min(1, "required").max(100),
  phone: phone(countryCode),
  phoneAlt: optionalPhone(countryCode),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
  locale: z.enum(["EN", "AR"]).default("EN"),
});

export type CustomerInput = z.input<ReturnType<typeof customerInput>>;
