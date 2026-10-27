"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Percent, Plus, Search, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShortcuts } from "@/components/app-shell/use-shortcuts";
import { deletePrice } from "@/features/prices/actions";
import type { PriceRow } from "@/features/prices/queries";
import { AdjustDialog, PriceDialog } from "@/features/prices/ui/price-dialogs";
import type { CatalogBrand } from "@/features/tickets/ui/device-picker";

type Props = { prices: PriceRow[]; catalog: CatalogBrand[]; canEdit: boolean; rate: number; rounding: number };

const norm = (s: string) => s.toLowerCase().normalize("NFKD");

/** The whole price list grouped by phone ("Any model" first), with search; owners add, edit, delete and change all. */
export function PriceList({ prices, catalog, canEdit, rate, rounding }: Props) {
  const t = useTranslations("prices");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ kind: "price"; price?: PriceRow } | { kind: "adjust" } | null>(null);
  const [key, setKey] = useState(0);
  const open = (d: NonNullable<typeof dialog>) => {
    setKey((k) => k + 1);
    setDialog(d);
  };
  useShortcuts({ n: () => canEdit && open({ kind: "price" }) });

  const services = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of prices) if (!seen.has(p.service.toLowerCase())) seen.set(p.service.toLowerCase(), p.service);
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [prices]);

  const groups = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const shown = prices.filter((p) => {
      const hay = norm(`${p.device ?? t("anyModel")} ${p.service}`);
      return words.every((w) => hay.includes(w) || hay.replace(/\s+/g, "").includes(w));
    });
    const map = new Map<string, { device: string | null; rows: PriceRow[] }>();
    for (const p of shown) {
      const k = p.modelId ?? "";
      if (!map.has(k)) map.set(k, { device: p.device, rows: [] });
      map.get(k)!.rows.push(p);
    }
    return [...map.entries()];
  }, [prices, q, t]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h2 className="font-semibold sm:me-auto">{t("listTitle", { count: prices.length })}</h2>
        {prices.length > 0 && (
          <div className="relative sm:w-64">
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input type="search" aria-label={t("search")} placeholder={t("search")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        {canEdit && (
          <div className="flex gap-2">
            {prices.length > 0 && (
              <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => open({ kind: "adjust" })}>
                <Percent />
                {t("adjustButton")}
              </Button>
            )}
            <Button className="flex-1 sm:flex-none" onClick={() => open({ kind: "price" })}>
              <Plus />
              {t("addButton")}
            </Button>
          </div>
        )}
      </div>

      {prices.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={Tags} title={t("emptyTitle")} body={canEdit ? t("emptyBodyOwner") : t("emptyBody")} />
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">{t("noMatch")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([k, g]) => (
            <section key={k} className="overflow-hidden rounded-xl border bg-card shadow-card">
              <h3 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold sm:px-6">{g.device ?? t("anyModel")}</h3>
              <ul className="divide-y">
                {g.rows.map((p) => (
                  <Row key={p.id} p={p} canEdit={canEdit} rate={rate} rounding={rounding} onEdit={() => open({ kind: "price", price: p })} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {dialog?.kind === "price" && (
        <PriceDialog key={key} open onOpenChange={(o) => !o && setDialog(null)} price={dialog.price} catalog={catalog} services={services} rate={rate} rounding={rounding} />
      )}
      {dialog?.kind === "adjust" && <AdjustDialog key={key} open onOpenChange={(o) => !o && setDialog(null)} prices={prices} services={services} />}
    </div>
  );
}

function Row({ p, canEdit, rate, rounding, onEdit }: { p: PriceRow; canEdit: boolean; rate: number; rounding: number; onEdit: () => void }) {
  const t = useTranslations("prices");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deletePrice(p.id);
      if (!res.ok) return void toast.error(te("generic"));
      toast.success(t("deleted"));
      router.refresh();
    });
  }

  return (
    <li className="flex min-h-12 items-center gap-3 px-4 py-2 sm:px-6">
      <span dir="auto" className="min-w-0 flex-1 truncate rtl:text-right">
        {p.service}
      </span>
      <Money usdCents={p.usdCents} rate={rate} rounding={rounding} layout="inline" usdClassName="font-semibold" lbpClassName="text-xs text-muted-foreground" />
      {canEdit && (
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={tc("edit")} title={tc("edit")}>
            <Pencil />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" disabled={pending} aria-label={t("delete")} title={t("delete")} className="text-destructive hover:text-destructive">
                <Trash2 />
              </Button>
            }
            title={t("deleteTitle")}
            body={t("deleteBody", { name: [p.device, p.service].filter(Boolean).join(" · ") })}
            confirmLabel={t("delete")}
            onConfirm={remove}
          />
        </div>
      )}
    </li>
  );
}
