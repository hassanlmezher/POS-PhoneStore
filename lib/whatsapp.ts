import { waNumber } from "@/lib/phone";

/** Replace {placeholders} in a template. Unknown placeholders are left as is. */
export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

/** wa.me link with a pre-filled message. Opened in a new tab; no API involved. */
export function waLink(phoneE164: string, text: string): string {
  return `https://wa.me/${waNumber(phoneE164)}?text=${encodeURIComponent(text)}`;
}
