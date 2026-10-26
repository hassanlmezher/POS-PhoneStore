import "server-only";
import QRCode from "qrcode";
import { formatTicketNumber } from "@/lib/numbering";
import type { ShopContext } from "@/lib/tenant";
import { trackUrl } from "./notify";
import type { TicketDetail } from "./queries";

/** Everything the intake receipt needs (80mm and A4 share it). */
export async function ticketPrintData(ctx: ShopContext, ticket: TicketDetail, locale: "en" | "ar") {
  const label = formatTicketNumber(ctx.shop.ticketPrefix, ticket.number);
  const url = trackUrl(ctx.shop.slug, ticket.trackToken);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const ar = locale === "ar";
  return {
    label,
    qrSvg,
    trackUrl: url,
    shop: {
      name: ctx.shop.name,
      logoUrl: ctx.shop.logoUrl,
      address: ctx.shop.address,
      phone: ctx.shop.phone,
      exchangeRate: ctx.shop.exchangeRate,
      lbpRounding: ctx.shop.lbpRounding,
      terms: (ar ? ctx.shop.termsTextAr : ctx.shop.termsText) ?? ctx.shop.termsText,
      footer: (ar ? ctx.shop.receiptFooterAr : ctx.shop.receiptFooter) ?? ctx.shop.receiptFooter,
    },
  };
}
