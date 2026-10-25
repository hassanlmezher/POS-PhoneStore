"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, MessageCircle, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown once after intake: print the receipt and send the "received" message. */
export function CreatedBanner({ number, label, receivedUrl }: { number: number; label: string; receivedUrl?: string }) {
  const t = useTranslations("ticket");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  function dismiss() {
    setOpen(false);
    router.replace(`/tickets/${number}`, { scroll: false });
  }
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-success/20 bg-success-soft p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {t("createdTitle")} <bdi dir="ltr">{label}</bdi>
          </p>
          <p className="text-sm text-muted-foreground">{t("createdBody")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <a href={`/print/ticket/${number}?size=80mm`} target="_blank" rel="noopener">
            <Printer />
            {t("printReceipt")}
          </a>
        </Button>
        {receivedUrl && (
          <Button variant="outline" asChild>
            <a href={receivedUrl} target="_blank" rel="noopener">
              <MessageCircle className="text-success" />
              {t("sendReceived")}
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label={tc("dismiss")}>
          <X />
        </Button>
      </div>
    </div>
  );
}
