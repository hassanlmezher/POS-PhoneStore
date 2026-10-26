"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { respondApproval } from "@/features/approvals/actions";

type Status = "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";

/** Public approve page: the two buttons, then the thank-you message. */
export function ApprovalAnswer({ token, initial }: { token: string; initial: Status }) {
  const t = useTranslations("approval");
  const [status, setStatus] = useState<Status>(initial);
  const [justAnswered, setJustAnswered] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"APPROVE" | "DECLINE" | null>(null);

  function answer(decision: "APPROVE" | "DECLINE") {
    setChoice(decision);
    setError(false);
    startTransition(async () => {
      try {
        const res = await respondApproval(token, decision);
        if (!res.ok) return setError(true);
        setJustAnswered(true);
        setStatus(res.status as Status);
      } catch {
        setError(true);
      }
    });
  }

  if (status === "PENDING") {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button size="lg" className="h-14 bg-success text-base text-success-foreground hover:bg-success/90" onClick={() => answer("APPROVE")} disabled={pending}>
            {pending && choice === "APPROVE" ? <Loader2 className="animate-spin" /> : <CircleCheck />}
            {t("approveBtn")}
          </Button>
          <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => answer("DECLINE")} disabled={pending}>
            {pending && choice === "DECLINE" ? <Loader2 className="animate-spin" /> : <CircleX />}
            {t("declineBtn")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("failed")}
          </p>
        )}
      </div>
    );
  }

  const approved = status === "APPROVED";
  const message =
    status === "CANCELLED" ? t("noLonger") : justAnswered ? t(approved ? "doneApproved" : "doneDeclined") : t(approved ? "alreadyApproved" : "alreadyDeclined");
  return (
    <p
      role="status"
      className={
        status === "CANCELLED"
          ? "rounded-xl bg-muted p-4 text-sm text-muted-foreground"
          : approved
            ? "flex items-center gap-2 rounded-xl bg-success-soft p-4 font-medium text-success"
            : "flex items-center gap-2 rounded-xl bg-muted p-4 font-medium"
      }
    >
      {status !== "CANCELLED" && (approved ? <CircleCheck className="size-5 shrink-0" aria-hidden /> : <CircleX className="size-5 shrink-0" aria-hidden />)}
      {message}
    </p>
  );
}
