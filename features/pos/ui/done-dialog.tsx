"use client";

import { useTranslations } from "next-intl";
import { CircleCheck, Plus, Printer } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, type Currency } from "@/lib/money";

export type DoneInfo = { number: number; changeAmount: number; changeCurrency: Currency | null; balanceUsdCents: number };

/** After checkout: sale number, change to hand back (big), print / new sale. */
export function DoneDialog({ info, rate, rounding, onNewSale }: { info: DoneInfo | null; rate: number; rounding: number; onNewSale: () => void }) {
  const t = useTranslations("pos");
  return (
    <Dialog open={!!info} onOpenChange={(open) => !open && onNewSale()}>
      <DialogContent className="sm:max-w-md">
        {info && (
          <>
            <DialogHeader className="items-center text-center">
              <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                <CircleCheck className="size-6" aria-hidden />
              </span>
              <DialogTitle className="text-xl">{t("doneTitle")}</DialogTitle>
              <DialogDescription>
                {t("doneSale")} <Ltr className="font-semibold text-foreground">#{info.number}</Ltr>
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border bg-muted/40 p-5 text-center">
              {info.changeAmount > 0 && info.changeCurrency ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("changeToGive")}</p>
                  <p className="mt-1 text-4xl font-semibold tracking-tight text-success tabular-nums">
                    <Ltr>{formatMoney(info.changeAmount, info.changeCurrency)}</Ltr>
                  </p>
                </>
              ) : (
                <p className="text-lg font-medium">{t("noChange")}</p>
              )}
            </div>

            {info.balanceUsdCents > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-warning-soft px-4 py-3 text-warning">
                <span className="text-sm font-medium">{t("balanceLeft")}</span>
                <Money usdCents={info.balanceUsdCents} rate={rate} rounding={rounding} layout="inline" usdClassName="text-warning" />
              </div>
            )}

            <DialogFooter className="gap-2 sm:grid sm:grid-cols-2">
              <Button variant="outline" size="lg" asChild>
                <a href={`/print/sale/${info.number}`} target="_blank" rel="noopener">
                  <Printer />
                  {t("printReceipt")}
                </a>
              </Button>
              <Button size="lg" autoFocus onClick={onNewSale}>
                <Plus />
                {t("newSale")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
