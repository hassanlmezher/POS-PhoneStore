"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { useShopCountryCode } from "@/components/shop-context";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer, updateCustomer } from "@/features/customers/actions";

type Customer = { id: string; name: string; phone: string; locale: "EN" | "AR"; notes: string | null };

type CustomerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when set. */
  customer?: Customer;
  /** Create mode: prefill (e.g. what was typed in a search box). */
  defaults?: { name?: string; phone?: string };
  /** Create mode: called with the new customer instead of opening their profile. */
  onCreated?: (c: { id: string; name: string; phone: string; locale: "EN" | "AR" }) => void;
};

export function CustomerDialog({ open, onOpenChange, customer, defaults, onCreated }: CustomerDialogProps) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const countryCode = useShopCountryCode();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(customer?.name ?? defaults?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? defaults?.phone ?? "");
  const [locale, setLocale] = useState<"EN" | "AR">(customer?.locale ?? "EN");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "required";
    if (!phone.trim()) local.phone = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const input = { name, phone, locale, notes };
      const res = customer ? await updateCustomer(customer.id, input) : await createCustomer(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(t("saveFailed"));
        return;
      }
      toast.success(customer ? t("updated") : t("created", { name: res.customer.name }));
      onOpenChange(false);
      if (customer) router.refresh();
      else if (onCreated) onCreated(res.customer);
      else router.push(`/customers/${res.customer.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{customer ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("phone")} htmlFor="cust-phone" error={errors.phone}>
            <Input
              {...fieldAria("cust-phone", errors.phone)}
              autoFocus
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="off"
              className="text-start"
              placeholder={countryCode ? `+${countryCode}` : undefined}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label={t("name")} htmlFor="cust-name" error={errors.name}>
            <Input {...fieldAria("cust-name", errors.name)} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("language")} htmlFor="cust-locale" hint={t("languageHint")}>
            <Segmented
              id="cust-locale"
              label={t("language")}
              value={locale}
              onValueChange={setLocale}
              options={[
                { value: "EN", label: tc("english") },
                { value: "AR", label: tc("arabic") },
              ]}
              className="w-full sm:w-64"
            />
          </Field>
          <Field label={t("notes")} htmlFor="cust-notes" optional error={errors.notes}>
            <Textarea {...fieldAria("cust-notes", errors.notes)} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : customer ? tc("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Button + dialog pair. */
export function CustomerDialogButton({
  customer,
  children,
  variant = "default",
}: {
  customer?: Customer;
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {children}
      </Button>
      {open && <CustomerDialog open={open} onOpenChange={setOpen} customer={customer} />}
    </>
  );
}
