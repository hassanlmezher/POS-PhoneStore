import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CircleCheckBig } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { FollowupButton } from "@/features/followups/ui/followup-button";

export type FollowupRow = {
  id: string;
  number: number;
  label: string;
  device: string;
  customer: string;
  days: number;
  /** wa.me link; null when the customer has no phone. */
  waUrl: string | null;
};

/** Phones due for the 3-day "how is your phone?" check. */
export async function FollowupList({ rows, canSend }: { rows: FollowupRow[]; canSend: boolean }) {
  const t = await getTranslations("followups");
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState icon={CircleCheckBig} title={t("allDone")} body={t("allDoneCheck")} />
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 font-semibold">
              <Link href={`/tickets/${r.number}`} className="hover:underline">
                <Ltr>{r.label}</Ltr>
              </Link>
              <span className="text-xs font-normal text-muted-foreground">{t("pickedUpAgo", { count: r.days })}</span>
            </p>
            <p dir="auto" className="truncate font-medium rtl:text-right">
              {r.device}
            </p>
            <p dir="auto" className="truncate text-sm text-muted-foreground rtl:text-right">
              {r.customer}
            </p>
          </div>
          {canSend && r.waUrl && <FollowupButton ticketId={r.id} href={r.waUrl} sent={false} className="sm:self-center" />}
        </li>
      ))}
    </ul>
  );
}
