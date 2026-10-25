"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { Field, fieldAria } from "@/components/field";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resetOwnerPassword } from "@/features/admin/actions";

export function ResetOwnerPasswordButton({ user }: { user: { id: string; name: string; email: string } }) {
  const t = useTranslations("admin.shop");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function close(o: boolean) {
    setOpen(o);
    if (!o) {
      setPassword("");
      setError(null);
      setDone(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("passwordTooShort");
    startTransition(async () => {
      const res = await resetOwnerPassword(user.id, password);
      if (!res.ok) return setError(res.fieldErrors?.password ?? "generic");
      toast.success(t("passwordReset", { name: user.name }));
      setDone(true);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={t("resetLabel", { name: user.name })}>
        <KeyRound />
        <span className="hidden sm:inline">{t("resetPassword")}</span>
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("resetTitle", { name: user.name })}</DialogTitle>
            <DialogDescription>
              <bdi dir="ltr">{user.email}</bdi>
            </DialogDescription>
          </DialogHeader>
          {done ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t("resetDone")}</p>
              <div className="flex gap-2">
                <input readOnly value={password} dir="ltr" aria-label={t("newPassword")} className="h-11 min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 font-mono text-sm" />
                <CopyButton value={password} />
              </div>
              <DialogFooter>
                <Button onClick={() => close(false)}>{tc("close")}</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <Field label={t("newPassword")} htmlFor="ro-password" error={error}>
                <PasswordInput {...fieldAria("ro-password", error)} autoFocus generate value={password} onValueChange={setPassword} />
              </Field>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => close(false)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? tc("saving") : t("resetPassword")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
