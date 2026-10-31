"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, CircleX, Clock, Loader2, MessageCircle, Plus, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { Field, fieldAria } from "@/components/field";
import { Money } from "@/components/money";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelApproval, createApproval, recordApprovalAnswer } from "@/features/approvals/actions";
import { cn } from "@/lib/utils";

export type ApprovalView = {
  id: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  amountUsdCents: number;
  previousUsdCents: number | null;
  reason: string;
  sentAt: string;
  answeredAt: string | null;
  /** Staff member who recorded the answer (told in person / by phone); null when answered by link. */
  recordedBy: string | null;
  /** wa.me link and public page, only for a pending request. */
  waUrl?: string;
  link?: string;
};

type Props = {
  ticketId: string;
  current: ApprovalView | null;
  canManage: boolean;
  /** Prefill for the new price: what the ticket charges today. */
  defaultUsdCents: number;
  rate: number;
  rounding: number;
};

/** Ticket page: ask the customer to approve a new price by WhatsApp link, and see the answer. */
export function ApprovalCard({ ticketId, current, canManage, defaultUsdCents, rate, rounding }: Props) {
  const t = useTranslations("approval");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function start() {
    setAmount(defaultUsdCents > 0 ? (defaultUsdCents / 100).toFixed(2) : "");
    setReason("");
    setErrors({});
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!amount.trim()) local.amount = "required";
    if (!reason.trim()) local.reason = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      try {
        const res = await createApproval(ticketId, { amount, reason });
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          if (!res.fieldErrors) toast.error(t("saveFailed"));
          return;
        }
        toast.success(t("ready"));
        setOpen(false);
        router.refresh();
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  /** The customer answered in person or by phone. */
  function record(decision: "APPROVE" | "DECLINE") {
    if (!current) return;
    startTransition(async () => {
      const res = await recordApprovalAnswer(current.id, decision);
      if (!res.ok) toast.error(t("saveFailed"));
      else toast.success(t(res.status === "APPROVED" ? "recordedApproved" : res.status === "DECLINED" ? "recordedDeclined" : "noLonger"));
      router.refresh();
    });
  }

  function cancel() {
    if (!current) return;
    startTransition(async () => {
      const res = await cancelApproval(current.id);
      if (res.ok) toast.success(t("cancelled"));
      router.refresh();
    });
  }

  if (open) {
    return (
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label={t("newPrice")} htmlFor="ap-amount" error={errors.amount}>
          <MoneyInput
            {...fieldAria("ap-amount", errors.amount)}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            value={amount}
            onValueChange={setAmount}
            currency="USD"
            rate={rate}
            rounding={rounding}
          />
        </Field>
        <Field label={t("reason")} htmlFor="ap-reason" error={errors.reason}>
          <Textarea
            {...fieldAria("ap-reason", errors.reason)}
            rows={3}
            maxLength={300}
            placeholder={t("reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t("create")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {current ? (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg p-3",
            current.status === "PENDING" && "bg-warning-soft",
            current.status === "APPROVED" && "bg-success-soft",
            current.status === "DECLINED" && "bg-destructive-soft",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              current.status === "PENDING" && "text-warning",
              current.status === "APPROVED" && "text-success",
              current.status === "DECLINED" && "text-destructive",
            )}
          >
            {current.status === "PENDING" ? <Clock className="size-4" aria-hidden /> : current.status === "APPROVED" ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
            {t(current.status === "PENDING" ? "pending" : current.status === "APPROVED" ? "approved" : "declined")}
          </p>
          <Money usdCents={current.amountUsdCents} rate={rate} rounding={rounding} className="text-lg" />
          {current.previousUsdCents !== null && current.previousUsdCents !== current.amountUsdCents && (
            <Money usdCents={current.previousUsdCents} rate={rate} rounding={rounding} layout="inline" className="text-xs text-muted-foreground line-through" usdClassName="font-normal text-muted-foreground" />
          )}
          <p className="text-sm whitespace-pre-line">{current.reason}</p>
          <p className="text-xs text-muted-foreground">
            {t("sentAt", { time: current.sentAt })}
            {current.answeredAt && <> · {t("answeredAt", { time: current.answeredAt })}</>}
          </p>
          {current.status !== "PENDING" && (
            <p className="text-xs text-muted-foreground">{current.recordedBy ? t("recordedBy", { name: current.recordedBy }) : t("answeredByLink")}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("askHint")}</p>
      )}

      {current?.status === "PENDING" && current.waUrl && (
        <div className="flex flex-col gap-2">
          <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
            <a href={current.waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              {t("send")}
            </a>
          </Button>
          {canManage && (
            <div className="flex gap-2">
              {current.link && <CopyButton value={current.link} label={t("copyLink")} />}
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="flex-1" disabled={pending}>
                    {t("cancel")}
                  </Button>
                }
                title={t("cancel")}
                confirmLabel={t("cancel")}
                onConfirm={cancel}
              />
            </div>
          )}
        </div>
      )}

      {current?.status === "PENDING" && canManage && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">{t("toldYou")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="border-success/40 text-success hover:bg-success-soft hover:text-success" disabled={pending} onClick={() => record("APPROVE")}>
              <ThumbsUp />
              {t("saidYes")}
            </Button>
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive-soft hover:text-destructive" disabled={pending} onClick={() => record("DECLINE")}>
              <ThumbsDown />
              {t("saidNo")}
            </Button>
          </div>
        </div>
      )}

      {canManage && current?.status !== "PENDING" && (
        <Button variant="outline" className="w-full" onClick={start}>
          {current ? <Plus /> : <Send className="rtl:-scale-x-100" />}
          {current ? t("newRequest") : t("ask")}
        </Button>
      )}
    </div>
  );
}
