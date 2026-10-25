"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { voidSale } from "@/features/pos/actions";

/** Owner only: void with a required reason. Stock goes back automatically. */
export function VoidSaleButton({ saleId, number }: { saleId: string; number: number }) {
  const t = useTranslations("sales");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      try {
        const res = await voidSale(saleId, reason);
        if (!res.ok) {
          toast.error(t.has(`voidErrors.${res.error}`) ? t(`voidErrors.${res.error}`) : t("voidFailed"));
          return;
        }
        toast.success(t("voidedToast", { number }));
        router.refresh();
      } catch {
        toast.error(t("voidFailed"));
      }
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-destructive hover:text-destructive" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Ban />}
          {t("void")}
        </Button>
      }
      title={t("voidTitle", { number })}
      body={t("voidBody")}
      confirmLabel={t("voidConfirm")}
      confirmDisabled={!reason.trim()}
      onConfirm={confirm}
    >
      <Field label={t("voidReason")} htmlFor="void-reason" hint={t("voidReasonHint")}>
        <Textarea id="void-reason" rows={2} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} aria-required />
      </Field>
    </ConfirmDialog>
  );
}
