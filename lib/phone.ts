/**
 * Normalize a phone number to E.164. `countryCode` is the shop's calling code (Shop.countryCode),
 * used for numbers typed in local format: with 961, "70 123 456" → "+96170123456".
 */
export function normalizePhone(input: string, countryCode: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else {
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = countryCode + digits;
  }
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
}

/** Trailing digits used for "contains" search, so local and international formats both match. */
export function phoneSearchDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length > 8 ? digits.slice(-8) : digits.replace(/^0/, "");
}

/** Number as used in wa.me links (digits only, no +). */
export function waNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}

/**
 * Display format: numbers from the shop's own country as dialled locally ("70 123 456", "03 123 456"),
 * others as E.164. `countryCode` = Shop.countryCode.
 */
export function formatPhone(e164: string, countryCode: string): string {
  const digits = e164.replace(/\D/g, "");
  if (countryCode && digits.startsWith(countryCode)) {
    let local = digits.slice(countryCode.length);
    if (local.length === 7) local = `0${local}`;
    if (local.length === 8) return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  }
  return e164;
}
