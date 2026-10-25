"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { savePlan } from "@/features/admin/actions";

type Plan = { id: string; name: string; priceUsdCents: number; maxStaff: number | null; active: boolean };

/** "Add plan" (no plan) or an edit icon button (with plan), each opening the plan dialog. */
export function PlanDialogButton({ plan }: { plan?: Plan }) {
  const t = useTranslations("admin.plans");
  const [open, setOpen] = useState(false);
  return (
    <>
      {plan ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={t("editLabel", { name: plan.name })}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          {t("add")}
        </Button>
      )}
      {open && <PlanDialog plan={plan} onClose={() => setOpen(false)} />}
    </>
  );
}

function PlanDialog({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const t = useTranslations("admin.plans");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    name: plan?.name ?? "",
    price: plan ? (plan.priceUsdCents / 100).toFixed(2) : "",
    maxStaff: plan?.maxStaff ? String(plan.maxStaff) : "",
    active: plan?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.name.trim()) local.name = "required";
    if (!v.price.trim()) local.price = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const res = await savePlan(plan?.id ?? null, v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(te("generic"));
        return;
      }
      toast.success(plan ? t("updated") : t("created"));
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{plan ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label={t("name")} htmlFor="pl-name" error={errors.name}>
            <Input {...fieldAria("pl-name", errors.name)} autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("price")} htmlFor="pl-price" error={errors.price}>
              <div className="relative">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" dir="ltr">
                  $
                </span>
                <Input
                  {...fieldAria("pl-price", errors.price)}
                  inputMode="decimal"
                  dir="ltr"
                  className="ps-7 text-start tabular-nums"
                  placeholder="0.00"
                  value={v.price}
                  onChange={(e) => setV({ ...v, price: e.target.value })}
                />
              </div>
            </Field>
            <Field label={t("maxStaff")} htmlFor="pl-staff" optional hint={t("maxStaffHint")} error={errors.maxStaff}>
              <Input
                {...fieldAria("pl-staff", errors.maxStaff)}
                type="number"
                inputMode="numeric"
                min={1}
                dir="ltr"
                className="text-start tabular-nums"
                value={v.maxStaff}
                onChange={(e) => setV({ ...v, maxStaff: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border px-3">
            <Label htmlFor="pl-active" className="flex-1 cursor-pointer py-3">
              {t("active")}
              <span className="block text-xs font-normal text-muted-foreground">{t("activeHint")}</span>
            </Label>
            <Switch id="pl-active" checked={v.active} onCheckedChange={(active) => setV({ ...v, active })} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : plan ? tc("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
