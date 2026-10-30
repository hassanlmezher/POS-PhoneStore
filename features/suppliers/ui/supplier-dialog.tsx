"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { saveSupplier } from "@/features/suppliers/actions";

type Supplier = { id: string; name: string; phone: string | null; note: string | null };

/** "Add supplier" / "Edit" button with its form. A new supplier opens its page. */
export function SupplierDialogButton({ supplier }: { supplier?: Supplier }) {
  const t = useTranslations("suppliers");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [note, setNote] = useState(supplier?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: "required" });
    startTransition(async () => {
      const res = await saveSupplier({ name, phone, note }, supplier?.id);
      if (!res.ok) {
        if (res.fieldErrors) return setErrors(res.fieldErrors);
        return void toast.error(te.has(res.error as never) ? te(res.error as never) : te("generic"));
      }
      toast.success(supplier ? t("updated") : t("added"));
      setOpen(false);
      if (supplier) router.refresh();
      else router.push(`/suppliers/${res.id}`);
    });
  }

  return (
    <>
      <Button variant={supplier ? "outline" : "default"} onClick={() => setOpen(true)}>
        {supplier ? <Pencil /> : <Plus />}
        {supplier ? tc("edit") : t("addSupplier")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{supplier ? t("editTitle") : t("addTitle")}</DialogTitle>
            <DialogDescription>{t("dialogHint")}</DialogDescription>
          </DialogHeader>
          <form id="supplier-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label={t("name")} htmlFor="sup-name" error={errors.name}>
              <Input {...fieldAria("sup-name", errors.name)} autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("phone")} htmlFor="sup-phone" optional error={errors.phone}>
              <Input {...fieldAria("sup-phone", errors.phone)} type="tel" inputMode="tel" dir="ltr" className="text-start" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label={t("note")} htmlFor="sup-note" optional>
              <Input id="sup-note" maxLength={300} placeholder={t("notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" form="supplier-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
