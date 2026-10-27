import { z } from "zod";
import { parseMoney } from "@/lib/money";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const shopProfileInput = z.object({
  name: z.string().trim().min(1, "required").max(100),
  address: optionalText(200),
  phone: optionalText(40),
  defaultLocale: z.enum(["EN", "AR"]),
  // IANA zone (e.g. "Asia/Beirut", "Asia/Dubai"); validated in the action with isTimeZone().
  timezone: z.string().trim().min(1, "required").max(64),
  // Calling code without "+" (961 Lebanon, 971 UAE, 966 KSA).
  countryCode: z.string().trim().regex(/^[1-9]\d{0,3}$/, "invalidCountryCode"),
  // Google "Ask for reviews" link (g.page/r/…, search.google.com/local/writereview?…); sent after pickup.
  googleReviewUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/[^\s]+\.[^\s]+$/.test(v), "invalidUrl"),
});
export type ShopProfileInput = z.input<typeof shopProfileInput>;

export const receiptSettingsInput = z.object({
  receiptFooter: optionalText(300),
  receiptFooterAr: optionalText(300),
  termsText: optionalText(2000),
  termsTextAr: optionalText(2000),
  ticketPrefix: z
    .string()
    .trim()
    .max(6)
    .regex(/^[A-Za-z]{0,5}-?$/, "invalidPrefix"),
  defaultWarrantyDays: z.coerce.number().int().min(0).max(3650),
  lbpRounding: z.coerce.number().int().refine((v) => [1, 100, 500, 1000, 5000, 10000].includes(v), "invalid"),
  storageFreeDays: z.coerce.number().int().min(0, "invalid").max(365, "invalid"),
  // Storage fee per day in USD ("1.50"); empty or 0 = no fee.
  storageFeeUsdCents: z
    .string()
    .trim()
    .max(12)
    .transform((v) => (v === "" ? 0 : parseMoney(v, "USD")))
    .refine((v): v is number => v !== null && v <= 100_000, "invalidAmount"),
});
export type ReceiptSettingsInput = z.input<typeof receiptSettingsInput>;

export const exchangeRateInput = z.object({
  // LBP per 1 USD. Sanity bounds catch typos like an extra zero.
  rate: z.coerce.number().int().min(1000, "rateTooLow").max(1_000_000, "rateTooHigh"),
});

export const TEMPLATE_KEYS = ["TICKET_RECEIVED", "TICKET_READY", "TICKET_WAITING_PART", "TICKET_CANT_FIX", "BALANCE_REMINDER"] as const;
export const TEMPLATE_PLACEHOLDERS = ["customer", "device", "ticket", "balance", "shop", "trackUrl"] as const;

export const templateInput = z.object({
  key: z.enum(TEMPLATE_KEYS),
  locale: z.enum(["EN", "AR"]),
  body: z.string().trim().min(1, "required").max(1000),
});
export type TemplateInput = z.input<typeof templateInput>;

export const STAFF_ROLES = ["OWNER", "TECHNICIAN", "CASHIER"] as const;

export const staffCreateInput = z.object({
  name: z.string().trim().min(1, "required").max(100),
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  role: z.enum(STAFF_ROLES),
  password: z.string().min(8, "passwordTooShort").max(128),
});
export type StaffCreateInput = z.input<typeof staffCreateInput>;

export const staffUpdateInput = z.object({
  name: z.string().trim().min(1, "required").max(100),
  role: z.enum(STAFF_ROLES),
  active: z.boolean(),
});
export type StaffUpdateInput = z.input<typeof staffUpdateInput>;

export const PRESET_KINDS = ["PROBLEM", "PAY_IN", "PAY_OUT"] as const;

export const presetInput = z
  .object({
    kind: z.enum(PRESET_KINDS),
    labelEn: z.string().trim().max(60),
    labelAr: z.string().trim().max(60),
  })
  .refine((v) => v.labelEn || v.labelAr, { path: ["labelEn"], message: "required" });
export type PresetInput = z.input<typeof presetInput>;
