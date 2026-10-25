import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchPos } from "@/features/pos/actions";
import { PosScreen } from "@/features/pos/ui/pos-screen";
import { parseTicketNumber } from "@/lib/numbering";
import { requirePermission } from "@/lib/tenant";

export default async function PosPage({ params, searchParams }: PageProps<"/shop/[slug]/pos">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { shop, readOnly } = await requirePermission(slug, "pos");
  const t = await getTranslations("pos");

  // ?ticket=<number>: preload that repair's balance (resolved through the POS search).
  let preload = null;
  const raw = typeof sp.ticket === "string" ? sp.ticket : "";
  const number = raw ? parseTicketNumber(raw) : null;
  if (number !== null) {
    const res = await searchPos(String(number));
    preload = res.tickets.find((tk) => tk.number === number) ?? null;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button variant="outline" asChild>
          <Link href="/sales">
            <Receipt />
            {t("salesHistory")}
          </Link>
        </Button>
      </div>
      {raw && !preload && (
        <p role="status" className="rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning">
          {t("ticketNotPayable", { ticket: raw })}
        </p>
      )}
      <PosScreen key={raw} rate={shop.exchangeRate} rounding={shop.lbpRounding} readOnly={readOnly} preloadTicket={preload} />
    </div>
  );
}
