"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Money } from "@/components/money";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is still owed when it goes out (USD cents). */
  owedUsdCents: number;
  rate: number;
  rounding: number;
  /** e.g. "This phone is handed over" / "This sale is finished". */
  body: React.ReactNode;
  /** Who will owe it, when known. */
  customer?: string | null;
  confirmLabel: React.ReactNode;
  onConfirm: () => void;
  /** "Take payment first" as a link (e.g. to the POS) instead of only going back. */
  payHref?: string;
};

/** Warning before something leaves the shop without being fully paid. */
export function UnpaidWarning({ open, onOpenChange, owedUsdCents, rate, rounding, body, customer, confirmLabel, onConfirm, payHref }: Props) {
  const t = useTranslations("unpaidWarning");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <span className="flex size-11 items-center justify-center rounded-full bg-warning-soft text-warning">
            <TriangleAlert aria-hidden className="size-5" />
          </span>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft/50 px-4 py-3">
          <span className="text-sm font-medium">{customer ? t("owedBy", { customer }) : t("stillOwed")}</span>
          <Money usdCents={owedUsdCents} rate={rate} rounding={rounding} className="items-end rtl:items-start" usdClassName="text-lg text-warning" />
        </div>
        {/* On phones the safe choice (take payment) comes first; going out unpaid is never the top button. */}
        <AlertDialogFooter className="flex-col sm:flex-row">
          <AlertDialogCancel className={payHref ? "order-3 sm:order-1 sm:me-auto" : "order-3 sm:order-1"}>{t("goBack")}</AlertDialogCancel>
          {payHref && (
            <Button className="order-1 sm:order-2" asChild>
              <Link href={payHref}>{t("takePayment")}</Link>
            </Button>
          )}
          <AlertDialogAction className="order-2 bg-warning text-warning-foreground hover:bg-warning/90 sm:order-3" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
