"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CircleCheckBig } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { Segmented } from "@/components/segmented";
import { FollowupButton } from "@/features/followups/ui/followup-button";

export type FollowupRow = {
  id: string;
  number: number;
  label: string;
  device: string;
  customer: string;
  days: number;
  /** wa.me link; null = no phone, or no review link for review rows. */
  waUrl: string | null;
};

type Props = { review: FollowupRow[]; check: FollowupRow[]; canSend: boolean; reviewMissing: React.ReactNode };

/** Two lists: thank-you + review request, and the 3-day "how is your phone?" check. */
export function FollowupList({ review, check, canSend, reviewMissing }: Props) {
  const t = useTranslations("followups");
  const [tab, setTab] = useState<"review" | "check">(review.length || !check.length ? "review" : "check");
  const rows = tab === "review" ? review : check;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label={t("title")}
        value={tab}
        onValueChange={setTab}
        options={[
          { value: "review", label: t("tabReview", { count: review.length }) },
          { value: "check", label: t("tabCheck", { count: check.length }) },
        ]}
        className="w-fit"
      />
      <p className="-mt-2 text-sm text-muted-foreground">{tab === "review" ? t("reviewHint") : t("checkHint")}</p>
      {tab === "review" && reviewMissing}
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={CircleCheckBig} title={t("allDone")} body={tab === "review" ? t("allDoneReview") : t("allDoneCheck")} />
        </div>
      ) : (
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
              {canSend && r.waUrl && <FollowupButton ticketId={r.id} kind={tab} href={r.waUrl} sent={false} className="sm:self-center" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
