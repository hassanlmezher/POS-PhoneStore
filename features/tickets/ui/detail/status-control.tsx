"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { UnpaidWarning } from "@/components/unpaid-warning";
import { changeTicketStatus } from "@/features/tickets/actions";
import { TICKET_STATUSES, type TicketStatusValue } from "@/features/tickets/schema";
import { NEXT_STATUS } from "../ticket-utils";

type Props = {
  ticketId: string;
  status: TicketStatusValue;
  /** Still owed: handing the phone over warns first when this is above zero. */
  balanceUsdCents: number;
  customer: string;
  rate: number;
  rounding: number;
  /** POS link to take the payment, when the user may use the POS. */
  payHref: string | null;
};

/** "Next step" button + menu with every status (optional note). Warns before an unpaid pickup. */
export function StatusControl({ ticketId, status, balanceUsdCents, customer, rate, rounding, payHref }: Props) {
  const tw = useTranslations("unpaidWarning");
  const t = useTranslations("ticket");
  const ts = useTranslations("status");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<TicketStatusValue | null>(null);
  const [note, setNote] = useState("");
  const next = NEXT_STATUS[status];
  const [unpaid, setUnpaid] = useState<{ to: TicketStatusValue; note?: string } | null>(null);

  function change(to: TicketStatusValue, withNote?: string, confirmed = false) {
    if (to === "PICKED_UP" && balanceUsdCents > 0 && !confirmed) {
      setTarget(null);
      return setUnpaid({ to, note: withNote });
    }
    startTransition(async () => {
      try {
        const res = await changeTicketStatus(ticketId, to, withNote);
        if (!res.ok) return void toast.error(t("statusFailed"));
        toast.success(t("statusChanged", { status: ts(to) }));
        setTarget(null);
        setNote("");
      } catch {
        toast.error(t("statusFailed"));
      }
    });
  }

  return (
    <div className="flex">
      {next && (
        <Button onClick={() => change(next)} disabled={pending} className="rounded-e-none">
          {pending && !target ? <Loader2 className="animate-spin" /> : <ArrowRight className="rtl:rotate-180" />}
          {t(`next.${next}`)}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={next ? "default" : "outline"}
            className={next ? "rounded-s-none border-s border-primary-foreground/20 px-3" : undefined}
            aria-label={t("changeStatus")}
            disabled={pending}
          >
            {!next && t("changeStatus")}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("setStatus")}</DropdownMenuLabel>
          {TICKET_STATUSES.filter((s) => s !== status).map((s) => (
            <DropdownMenuItem key={s} onSelect={() => setTarget(s)}>
              <StatusBadge status={s} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{target && t("moveToTitle", { status: ts(target) })}</DialogTitle>
            <DialogDescription>{t("noteOptional")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (target) change(target, note);
            }}
          >
            <Field label={t("note")} htmlFor="status-note" optional>
              <Textarea
                id="status-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && target) {
                    e.preventDefault();
                    change(target, note);
                  }
                }}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {tc("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UnpaidWarning
        open={!!unpaid}
        onOpenChange={(o) => !o && setUnpaid(null)}
        owedUsdCents={balanceUsdCents}
        rate={rate}
        rounding={rounding}
        customer={customer}
        body={tw("pickupBody")}
        confirmLabel={tw("pickupAnyway")}
        payHref={payHref ?? undefined}
        onConfirm={() => {
          if (unpaid) change(unpaid.to, unpaid.note, true);
          setUnpaid(null);
        }}
      />
    </div>
  );
}
