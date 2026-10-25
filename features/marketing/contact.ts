import "server-only";
import { getPlatformSettings } from "@/lib/platform";
import { waLink } from "@/lib/whatsapp";

export type MarketingContact = { whatsapp: string | null; email: string | null };

/** Sales contact details from the platform settings (admin). Both are optional; the page hides what's missing. */
export async function marketingContact(): Promise<MarketingContact> {
  const p = await getPlatformSettings();
  return { whatsapp: p.contactWhatsapp?.trim() || null, email: p.contactEmail?.trim() || null };
}

/** "Book a demo" link: wa.me with a prefilled message, else mailto, else null (CTA hidden). */
export function demoHref({ whatsapp, email }: MarketingContact, message: string): string | null {
  if (whatsapp) return waLink(whatsapp, message);
  if (email) return `mailto:${email}?subject=${encodeURIComponent(message)}`;
  return null;
}

/** Link props for an external CTA (wa.me opens in a new tab). */
export function externalProps(href: string) {
  return href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};
}
