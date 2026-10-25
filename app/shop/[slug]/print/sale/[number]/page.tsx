import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AutoPrint } from "@/components/auto-print";
import { getSaleByNumber } from "@/features/pos/queries";
import { dirOf, isLocale, type AppLocale } from "@/i18n/config";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { formatPhone } from "@/lib/phone";
import { requirePermission } from "@/lib/tenant";

export default async function PrintSalePage({ params, searchParams }: PageProps<"/shop/[slug]/print/sale/[number]">) {
  const { slug, number: raw } = await params;
  const sp = await searchParams;
  const number = Number(raw);
  if (!Number.isInteger(number) || number <= 0) notFound();
  const { db, shop } = await requirePermission(slug, "pos");
  const sale = await getSaleByNumber(db, number);
  if (!sale) notFound();

  const locale: AppLocale = isLocale(sp.lang) ? sp.lang : ((await getLocale()) as AppLocale);
  const [t, tm, format] = await Promise.all([
    getTranslations({ locale, namespace: "printSale" }),
    getTranslations({ locale, namespace: "paymentMethods" }),
    getFormatter({ locale }),
  ]);
  const rate = sale.payments[0]?.rate ?? shop.exchangeRate;
  const usd = (c: number) => (
    <bdi dir="ltr" className="tabular-nums">
      {formatMoney(c, "USD")}
    </bdi>
  );
  const voided = sale.status === "VOIDED";
  const footer = (locale === "ar" ? shop.receiptFooterAr : shop.receiptFooter) ?? shop.receiptFooter;

  return (
    <div lang={locale} dir={dirOf(locale)} className="receipt relative mx-auto w-[72mm] p-2 font-sans text-[11px] leading-snug text-black print:p-0">
      <style>{`
        @page { size: 80mm auto; margin: 4mm; }
        @media print { html, body { background: #fff !important; } }
        .receipt, .receipt * { color: #000 !important; border-color: #000 !important; }
      `}</style>

      <div className="mb-4 flex justify-center print:hidden">
        <AutoPrint label={t("printButton")} />
      </div>

      {voided && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="-rotate-30 border-4 px-4 text-5xl font-black tracking-widest opacity-25">{t("void")}</span>
        </div>
      )}

      <header className="flex flex-col items-center gap-1 text-center">
        {shop.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logoUrl} alt="" className="h-12 object-contain grayscale" />
        )}
        <p className="text-base font-bold">{shop.name}</p>
        {shop.address && <p>{shop.address}</p>}
        {shop.phone && (
          <p>
            <bdi dir="ltr">{shop.phone}</bdi>
          </p>
        )}
      </header>

      <div className="my-3 border-y border-dashed py-2 text-center">
        <p className="text-xs uppercase">{voided ? t("voidedReceipt") : t("receipt")}</p>
        <p className="text-2xl font-extrabold tracking-tight">
          {t("sale")} <bdi dir="ltr">#{sale.number}</bdi>
        </p>
      </div>

      <dl className="flex flex-col gap-0.5">
        <div className="flex justify-between gap-2">
          <dt className="font-semibold">{t("date")}</dt>
          <dd>{format.dateTime(sale.createdAt, { dateStyle: "medium", timeStyle: "short" })}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold">{t("cashier")}</dt>
          <dd>{sale.cashier.name}</dd>
        </div>
        {sale.customer && (
          <div className="flex justify-between gap-2">
            <dt className="font-semibold">{t("customer")}</dt>
            <dd className="text-end">
              {sale.customer.name}
              <br />
              <bdi dir="ltr">{formatPhone(sale.customer.phone, shop.countryCode)}</bdi>
            </dd>
          </div>
        )}
      </dl>

      <ul className="mt-3 flex flex-col gap-1.5 border-t border-dashed pt-3">
        {sale.items.map((i) => (
          <li key={i.id}>
            <div className="flex justify-between gap-2">
              <span className="min-w-0 font-semibold break-words">
                {i.kind === "TICKET_BALANCE" && i.ticket ? (
                  <>
                    {t("repairPayment")} <bdi dir="ltr">{formatTicketNumber(shop.ticketPrefix, i.ticket.number)}</bdi>
                  </>
                ) : (
                  i.description
                )}
              </span>
              {usd(i.qty * i.unitPriceUsdCents - i.discountUsdCents)}
            </div>
            {i.kind === "PRODUCT" ? (
              <p>
                <bdi dir="ltr" className="tabular-nums">
                  {i.qty} × {formatMoney(i.unitPriceUsdCents, "USD")}
                </bdi>
                {i.discountUsdCents > 0 && (
                  <>
                    {" · "}
                    {t("discount")} <bdi dir="ltr">−{formatMoney(i.discountUsdCents, "USD")}</bdi>
                  </>
                )}
              </p>
            ) : (
              <p className="break-words">{i.description}</p>
            )}
          </li>
        ))}
      </ul>

      <dl className="mt-3 flex flex-col gap-0.5 border-t border-dashed pt-3">
        <div className="flex justify-between gap-2">
          <dt>{t("subtotal")}</dt>
          <dd>{usd(sale.subtotalUsdCents)}</dd>
        </div>
        {sale.discountUsdCents > 0 && (
          <div className="flex justify-between gap-2">
            <dt>{t("discount")}</dt>
            <dd>
              <bdi dir="ltr">−{formatMoney(sale.discountUsdCents, "USD")}</bdi>
            </dd>
          </div>
        )}
        <div className="mt-1 flex justify-between gap-2 text-sm font-bold">
          <dt>{t("total")}</dt>
          <dd>{usd(sale.totalUsdCents)}</dd>
        </div>
        <div className="flex justify-between gap-2 font-bold">
          <dt />
          <dd>
            <bdi dir="ltr" className="tabular-nums">
              {formatMoney(toLbp(sale.totalUsdCents, rate, shop.lbpRounding), "LBP")}
            </bdi>
          </dd>
        </div>
        <p className="text-end text-[9.5px]">
          {t("rate")} <bdi dir="ltr">{rate.toLocaleString("en-US")} LBP / $</bdi>
        </p>
      </dl>

      <dl className="mt-3 flex flex-col gap-0.5 border-t border-dashed pt-3">
        {sale.payments.map((p) => (
          <div key={p.id} className="flex justify-between gap-2">
            <dt>
              {tm(p.method)}
              {p.reference && (
                <>
                  {" "}
                  <bdi dir="ltr" className="text-[9.5px]">
                    ({p.reference})
                  </bdi>
                </>
              )}
            </dt>
            <dd>
              <bdi dir="ltr" className="tabular-nums">
                {formatMoney(p.amount, p.currency)}
              </bdi>
            </dd>
          </div>
        ))}
        {sale.payments.length === 0 && <p>{t("unpaid")}</p>}
        {sale.changeAmount > 0 && sale.changeCurrency && (
          <div className="flex justify-between gap-2 font-semibold">
            <dt>{t("change")}</dt>
            <dd>
              <bdi dir="ltr" className="tabular-nums">
                {formatMoney(sale.changeAmount, sale.changeCurrency)}
              </bdi>
            </dd>
          </div>
        )}
        {sale.balanceUsdCents > 0 && (
          <div className="mt-1 flex justify-between gap-2 border-t border-dashed pt-1 text-sm font-bold">
            <dt>{t("balanceDue")}</dt>
            <dd className="text-end">
              {usd(sale.balanceUsdCents)}
              <br />
              <bdi dir="ltr" className="text-[10px] font-normal tabular-nums">
                {formatMoney(toLbp(sale.balanceUsdCents, rate, shop.lbpRounding), "LBP")}
              </bdi>
            </dd>
          </div>
        )}
      </dl>

      {footer ? <p className="mt-4 text-center whitespace-pre-line">{footer}</p> : <p className="mt-4 text-center">{t("thanks")}</p>}
    </div>
  );
}
