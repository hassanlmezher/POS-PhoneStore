"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { listWarrantyRepairs, type WarrantyRepair } from "@/features/comebacks/actions";
import { ComebackDialog } from "@/features/comebacks/ui/comeback-dialog";

/** At check-in: the picked customer's repairs still under warranty, each with "Came back under warranty". */
export function WarrantyBanner({ customerId, problem }: { customerId: string | null; problem: string }) {
  const t = useTranslations("comebacks");
  const format = useFormatter();
  const [found, setFound] = useState<{ customerId: string; rows: WarrantyRepair[] } | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let alive = true;
    listWarrantyRepairs(customerId)
      .then((rows) => alive && setFound({ customerId, rows }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [customerId]);

  const rows = found && found.customerId === customerId ? found.rows : [];
  if (!customerId || rows.length === 0) return null;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success-soft/50 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck aria-hidden className="size-4 text-success" />
        {t("bannerTitle", { count: rows.length })}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-lg bg-card p-3 shadow-card sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                <Ltr>{r.label}</Ltr> · <span dir="auto">{r.device}</span>
              </p>
              <p dir="auto" className="truncate text-xs text-muted-foreground rtl:text-right">
                {r.problem} · {t("validUntil", { date: format.dateTime(new Date(r.until), { dateStyle: "medium" }) })}
              </p>
            </div>
            <ComebackDialog originalId={r.id} label={r.label} device={r.device} warrantyUntil={r.until} defaultProblem={problem} className="h-10" />
          </li>
        ))}
      </ul>
    </div>
  );
}
