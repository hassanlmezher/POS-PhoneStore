"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createComeback } from "@/features/comebacks/actions";
import { cn } from "@/lib/utils";

type Props = {
  originalId: string;
  label: string;
  device: string;
  /** ISO date the original warranty ends; null = no warranty. */
  warrantyUntil: string | null;
  defaultProblem?: string;
  variant?: "outline" | "default";
  className?: string;
};

/** "Came back under warranty": opens a free repair linked to the original ticket. */
export function ComebackDialog({ originalId, label, device, warrantyUntil, defaultProblem = "", variant = "outline", className }: Props) {
  const t = useTranslations("comebacks");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState(defaultProblem);
  const [error, setError] = useState<string>();
  const until = warrantyUntil ? new Date(warrantyUntil) : null;
  const [now] = useState(() => Date.now());
  const valid = !!until && until.getTime() > now;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!problem.trim()) return setError("required");
    startTransition(async () => {
      const res = await createComeback(originalId, problem);
      if (!res.ok) {
        if (res.fieldErrors?.problem) return setError(res.fieldErrors.problem);
        return void toast.error(te.has(res.error as never) ? te(res.error as never) : te("generic"));
      }
      toast.success(t("created"));
      setOpen(false);
      router.push(`/tickets/${res.number}`);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => {
          setProblem(defaultProblem);
          setError(undefined);
          setOpen(true);
        }}
      >
        <RotateCcw />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("hint")}</DialogDescription>
          </DialogHeader>
          <form id={`comeback-${originalId}`} onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                <Ltr>{label}</Ltr> · <span dir="auto">{device}</span>
              </p>
              <p className={cn("mt-1 flex items-center gap-1.5", valid ? "text-success" : "text-warning")}>
                {valid ? <ShieldCheck aria-hidden className="size-4" /> : <ShieldAlert aria-hidden className="size-4" />}
                {until
                  ? t(valid ? "validUntil" : "endedOn", { date: format.dateTime(until, { dateStyle: "medium" }) })
                  : t("noWarranty")}
              </p>
            </div>
            <Field label={t("problem")} htmlFor={`comeback-${originalId}-problem`} error={error}>
              <Textarea
                {...fieldAria(`comeback-${originalId}-problem`, error)}
                autoFocus
                rows={3}
                placeholder={t("problemPlaceholder")}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">{t("freeNote")}</p>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" form={`comeback-${originalId}`} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t("open")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
