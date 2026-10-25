import { getLocale, getTranslations } from "next-intl/server";
import { AutoPrint } from "@/components/auto-print";
import { getProductsForLabels } from "@/features/inventory/queries";
import { dirOf, isLocale, type AppLocale } from "@/i18n/config";
import { canEncodeCode128, code128Svg } from "@/lib/barcode";
import { formatMoney, toLbp } from "@/lib/money";
import { requireShop } from "@/lib/tenant";
import { cn } from "@/lib/utils";

const MAX_LABELS = 500;

export default async function PrintLabelsPage({ params, searchParams }: PageProps<"/shop/[slug]/print/labels">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { db, shop } = await requireShop(slug);
  const locale: AppLocale = isLocale(sp.lang) ? sp.lang : ((await getLocale()) as AppLocale);
  const t = await getTranslations({ locale, namespace: "labels" });

  const ids = (typeof sp.ids === "string" ? sp.ids : "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  const copies = Math.max(1, Math.min(100, Math.floor(Number(sp.copies)) || 1));
  const a4 = sp.layout === "a4";
  const products = ids.length ? await getProductsForLabels(db, ids) : [];
  const labels = products.flatMap((p) => Array.from({ length: copies }, (_, i) => ({ ...p, key: `${p.id}-${i}` }))).slice(0, MAX_LABELS);

  return (
    <div lang={locale} dir={dirOf(locale)} className={cn("labels font-sans text-black", a4 ? "p-6 print:p-0" : "p-6 print:p-0")}>
      <style>{`
        @page { size: ${a4 ? "A4" : "50mm 30mm"}; margin: ${a4 ? "10mm 7mm" : "0"}; }
        @media print { html, body { background: #fff !important; } }
        .labels, .labels * { color: #000 !important; }
        .label svg { width: 100%; height: 100%; display: block; }
        @media print { .label-roll { break-after: page; page-break-after: always; } .label-roll:last-child { break-after: auto; page-break-after: auto; } }
      `}</style>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
        <p className="text-sm text-neutral-600">{t("summary", { count: labels.length })}</p>
        {labels.length > 0 && <AutoPrint label={t("printButton")} />}
      </div>

      {labels.length === 0 ? (
        <p className="text-center text-sm print:hidden">{t("empty")}</p>
      ) : (
        <div className={cn(a4 ? "grid grid-cols-[repeat(3,63.5mm)] justify-center gap-x-[2.5mm]" : "flex flex-wrap justify-center gap-4 print:block")}>
          {labels.map((p) => {
            const code = p.barcode && canEncodeCode128(p.barcode) ? p.barcode : p.sku && canEncodeCode128(p.sku) ? p.sku : null;
            return (
              <div
                key={p.key}
                className={cn(
                  "label flex flex-col overflow-hidden bg-white text-center leading-tight",
                  a4 ? "h-[38.1mm] w-[63.5mm] px-[3mm] py-[2mm] outline outline-dashed outline-neutral-300 print:outline-none" : "label-roll h-[30mm] w-[50mm] px-[2mm] py-[1.5mm] outline outline-dashed outline-neutral-300 print:outline-none",
                )}
              >
                <p className="flex items-center justify-center gap-[1mm] truncate text-[6pt]">
                  {shop.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- local, versioned file route
                    <img src={shop.logoUrl} alt="" className="h-[3mm] w-auto object-contain grayscale" />
                  )}
                  <span className="truncate">{shop.name}</span>
                </p>
                <p className="line-clamp-2 text-[7.5pt] font-bold">{p.name}</p>
                {code ? (
                  <>
                    <div className="mx-auto mt-auto h-[9mm] w-full max-w-[44mm]" dangerouslySetInnerHTML={{ __html: code128Svg(code, { height: 40, moduleWidth: 1 }) }} />
                    <p dir="ltr" className="font-mono text-[6pt] tracking-wider">
                      {code}
                    </p>
                  </>
                ) : (
                  <p dir="ltr" className="mt-auto font-mono text-[7pt]">
                    {p.barcode ?? p.sku ?? ""}
                  </p>
                )}
                <p dir="ltr" className="flex items-baseline justify-center gap-1.5 tabular-nums">
                  <span className="text-[10pt] font-extrabold">{formatMoney(p.priceUsdCents, "USD")}</span>
                  <span className="text-[6pt]">{formatMoney(toLbp(p.priceUsdCents, shop.exchangeRate, shop.lbpRounding), "LBP")}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
