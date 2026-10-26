import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AutoPrint } from "@/components/auto-print";
import { getTicketByNumber } from "@/features/tickets/queries";
import { ticketPrintData } from "@/features/tickets/print";
import { dirOf, isLocale, type AppLocale } from "@/i18n/config";
import { formatMoney, toLbp } from "@/lib/money";
import { parseTicketNumber } from "@/lib/numbering";
import { formatPhone } from "@/lib/phone";
import { requireShop } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export default async function PrintTicketPage({ params, searchParams }: PageProps<"/shop/[slug]/print/ticket/[number]">) {
  const { slug, number: raw } = await params;
  const sp = await searchParams;
  const number = parseTicketNumber(raw);
  if (number === null) notFound();
  const ctx = await requireShop(slug);
  const ticket = await getTicketByNumber(ctx, number);
  if (!ticket) notFound();

  const locale: AppLocale = isLocale(sp.lang) ? sp.lang : ((await getLocale()) as AppLocale);
  const a4 = sp.size === "a4";
  const [data, t, ta, format] = await Promise.all([
    ticketPrintData(ctx, ticket, locale),
    getTranslations({ locale, namespace: "print" }),
    getTranslations({ locale, namespace: "accessories" }),
    getFormatter({ locale }),
  ]);
  const { shop } = data;
  const money = (usdCents: number) => (
    <span dir="ltr" className="tabular-nums">
      {formatMoney(usdCents, "USD")} <span className="text-[0.85em]">/ {formatMoney(toLbp(usdCents, shop.exchangeRate, shop.lbpRounding), "LBP")}</span>
    </span>
  );
  const date = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });

  const rows: [string, React.ReactNode][] = [
    [t("received"), date(ticket.createdAt)],
    [t("customer"), ticket.customer.name],
    [t("phone"), <bdi key="p" dir="ltr">{formatPhone(ticket.customer.phone, ctx.shop.countryCode)}</bdi>],
    [t("device"), ticket.device],
    ...(ticket.imei ? [[t("imei"), <bdi key="i" dir="ltr" className="font-mono">{ticket.imei}</bdi>] as [string, React.ReactNode]] : []),
    ...(ticket.color ? [[t("color"), ticket.color] as [string, React.ReactNode]] : []),
    [t("accessories"), ticket.accessories.length ? ticket.accessories.map((a) => (ta.has(a) ? ta(a) : a)).join(locale === "ar" ? "، " : ", ") : t("none")],
  ];
  const moneyRows: [string, React.ReactNode][] = [
    ...(ticket.estimateUsdCents !== null ? [[t("estimate"), money(ticket.estimateUsdCents)] as [string, React.ReactNode]] : []),
    [t("deposit"), money(ticket.paidUsdCents)],
    [t("balance"), money(Math.max(0, ticket.balanceUsdCents))],
  ];

  return (
    <div lang={locale} dir={dirOf(locale)} className={cn("receipt mx-auto font-sans text-black", a4 ? "max-w-[190mm] p-8 text-sm print:p-0" : "w-[72mm] p-2 text-[11px] leading-snug print:p-0")}>
      <style>{`
        @page { size: ${a4 ? "A4" : "80mm auto"}; margin: ${a4 ? "12mm" : "4mm"}; }
        @media print { html, body { background: #fff !important; } }
        .receipt, .receipt * { color: #000 !important; border-color: #000 !important; }
      `}</style>

      <div className="mb-4 flex justify-center print:hidden">
        <AutoPrint label={t("printButton")} auto={sp.preview !== "1"} />
      </div>

      <header className={cn("flex flex-col items-center gap-1 text-center", a4 && "items-start text-start")}>
        {shop.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logoUrl} alt="" className={cn("object-contain grayscale", a4 ? "h-16" : "h-12")} />
        )}
        <p className={cn("font-bold", a4 ? "text-xl" : "text-base")}>{shop.name}</p>
        {shop.address && <p>{shop.address}</p>}
        {shop.phone && (
          <p>
            <bdi dir="ltr">{shop.phone}</bdi>
          </p>
        )}
      </header>

      <div className={cn("my-3 flex items-center gap-3 border-y border-dashed py-3", a4 ? "justify-between" : "flex-col")}>
        <div className={cn(a4 ? "text-start" : "text-center")}>
          <p className="text-xs uppercase">{t("repairTicket")}</p>
          <p className={cn("font-extrabold tracking-tight", a4 ? "text-4xl" : "text-3xl")} dir="ltr">
            {data.label}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className={cn("[&_svg]:h-full [&_svg]:w-full", a4 ? "size-28" : "size-24")} dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
          <p className="text-[9px]">{t("scanToTrack")}</p>
        </div>
      </div>

      <div className={cn(a4 && "grid grid-cols-2 gap-8")}>
        <dl className="flex flex-col gap-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className={cn("shrink-0 font-semibold", a4 ? "w-32" : "w-[24mm]")}>{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className={cn("flex flex-col gap-2", !a4 && "mt-3")}>
          <div>
            <p className="font-semibold">{t("problem")}</p>
            <p className="whitespace-pre-line">{ticket.problem}</p>
          </div>
          {ticket.conditionNotes && (
            <div>
              <p className="font-semibold">{t("condition")}</p>
              <p className="whitespace-pre-line">{ticket.conditionNotes}</p>
            </div>
          )}
        </div>
      </div>

      <dl className="mt-3 flex flex-col gap-1 border-t border-dashed pt-3">
        {moneyRows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="font-semibold">{k}</dt>
            <dd className="text-end">{v}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-3 flex flex-col gap-1 border-t border-dashed pt-3">
        <div className="flex justify-between gap-2">
          <dt className="font-semibold">{t("promised")}</dt>
          <dd>{ticket.promisedAt ? format.dateTime(ticket.promisedAt, { dateStyle: "medium" }) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold">{t("technician")}</dt>
          <dd>{ticket.assignedTo?.name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold">{t("warranty")}</dt>
          <dd>{t("warrantyDays", { count: ticket.warrantyDays })}</dd>
        </div>
      </dl>

      {ctx.shop.storageFeeUsdCents > 0 && (
        <p className={cn("mt-3 border-t border-dashed pt-3 font-semibold", a4 ? "text-xs" : "text-[10px]")}>
          {t("storageNote", { days: ctx.shop.storageFreeDays, fee: formatMoney(ctx.shop.storageFeeUsdCents, "USD") })}
        </p>
      )}

      {shop.terms && (
        <div className="mt-3 border-t border-dashed pt-3">
          <p className="font-semibold">{t("terms")}</p>
          <p className={cn("whitespace-pre-line", a4 ? "text-xs" : "text-[9.5px]")}>{shop.terms}</p>
        </div>
      )}

      <div className={cn("mt-8 grid grid-cols-1 gap-6", a4 && "grid-cols-2")}>
        <div>
          <div className="h-10 border-b" />
          <p className="mt-1 text-center text-[10px]">{t("customerSignature")}</p>
        </div>
        {a4 && (
          <div>
            <div className="h-10 border-b" />
            <p className="mt-1 text-center text-[10px]">{t("shopSignature")}</p>
          </div>
        )}
      </div>

      {shop.footer && <p className="mt-4 text-center whitespace-pre-line">{shop.footer}</p>}
      <p className="mt-2 text-center text-[9px]" dir="ltr">
        {data.trackUrl}
      </p>
    </div>
  );
}
