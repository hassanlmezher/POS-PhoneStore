"use client";

import { useFormatter, useTranslations } from "next-intl";
import { History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { SectionCard } from "@/components/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RateForm } from "./rate-form";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type Props = {
  rate: number;
  history: { id: string; rate: number; at: Date; by: string | null }[];
  readOnly: boolean;
};

export function RateSection({ rate, history, readOnly }: Props) {
  const t = useTranslations("settings.rate");
  const tc = useTranslations("common");
  const format = useFormatter();

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <SectionCard title={t("currentTitle")} description={t("currentDescription")}>
        <div className="flex flex-col gap-6">
          <p className="flex flex-wrap items-baseline gap-x-2" dir="ltr">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{fmt.format(rate)}</span>
            <span className="text-sm text-muted-foreground">{tc("perUsd")}</span>
          </p>
          {readOnly ? <p className="text-sm text-muted-foreground">{tc("readOnlyBanner")}</p> : <RateForm rate={rate} />}
        </div>
      </SectionCard>

      <SectionCard title={t("historyTitle")} description={t("historyDescription")} padded={false}>
        {history.length === 0 ? (
          <EmptyState icon={History} title={t("historyEmpty")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead className="text-end">{t("rate")}</TableHead>
                <TableHead className="text-end">{t("change")}</TableHead>
                <TableHead>{t("by")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r, i) => {
                const prev = history[i + 1]?.rate;
                const diff = prev ? r.rate - prev : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{format.dateTime(r.at, { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                    <TableCell className="text-end font-medium">
                      <Ltr>{fmt.format(r.rate)}</Ltr>
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {prev ? <Ltr className={diff > 0 ? "text-warning" : diff < 0 ? "text-success" : undefined}>{diff > 0 ? `+${fmt.format(diff)}` : fmt.format(diff)}</Ltr> : "—"}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{r.by ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
