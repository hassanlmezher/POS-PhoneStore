"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { KeyRound, Pencil, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/components/app-shell/shop-mark";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Field, fieldAria } from "@/components/field";
import { PasswordInput } from "@/components/password-input";
import { SectionCard } from "@/components/section-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createStaff, resetStaffPassword, updateStaff } from "@/features/settings/actions";
import { STAFF_ROLES } from "@/features/settings/schema";
import { cn } from "@/lib/utils";

type Role = (typeof STAFF_ROLES)[number];
type Staff = { id: string; name: string; email: string; role: Role; active: boolean; createdAt: Date };

type Props = { staff: Staff[]; currentUserId: string; maxStaff: number | null; readOnly: boolean };

export function StaffSection({ staff, currentUserId, maxStaff, readOnly }: Props) {
  const t = useTranslations("settings.staff");
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "edit" | "password"; user: Staff } | null>(null);
  const activeCount = staff.filter((s) => s.active).length;
  const atLimit = maxStaff !== null && activeCount >= maxStaff;

  return (
    <SectionCard
      title={t("title")}
      description={
        maxStaff !== null ? (
          <span className={cn(atLimit && "text-warning")}>{t("limit", { used: activeCount, max: maxStaff })}</span>
        ) : (
          t("description")
        )
      }
      padded={false}
      actions={
        <Button onClick={() => setDialog({ kind: "add" })} disabled={readOnly || atLimit} title={atLimit ? t("limitReached") : undefined}>
          <UserPlus />
          {t("add")}
        </Button>
      }
    >
      {atLimit && !readOnly && (
        <p role="status" className="border-b bg-warning-soft px-4 py-2.5 text-sm text-warning sm:px-6">
          {t("limitReached")}
        </p>
      )}
      {staff.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("email")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("role")}</TableHead>
              {/* Role is shown under the name on phones. */}
              <TableHead>{t("status")}</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => (
              <StaffRow
                key={s.id}
                user={s}
                isMe={s.id === currentUserId}
                readOnly={readOnly}
                onEdit={() => setDialog({ kind: "edit", user: s })}
                onPassword={() => setDialog({ kind: "password", user: s })}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {dialog?.kind === "add" && <AddStaffDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && <EditStaffDialog user={dialog.user} isMe={dialog.user.id === currentUserId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "password" && <ResetPasswordDialog user={dialog.user} onClose={() => setDialog(null)} />}
    </SectionCard>
  );
}

function StaffRow({ user, isMe, readOnly, onEdit, onPassword }: { user: Staff; isMe: boolean; readOnly: boolean; onEdit: () => void; onPassword: () => void }) {
  const t = useTranslations("settings.staff");
  const tr = useTranslations("roles");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setActive(active: boolean) {
    startTransition(async () => {
      const res = await updateStaff(user.id, { name: user.name, role: user.role, active });
      if (!res.ok) return void toast.error(staffError(t, res.error));
      toast.success(active ? t("activated", { name: user.name }) : t("deactivated", { name: user.name }));
      router.refresh();
    });
  }

  const toggle = <Switch checked={user.active} disabled={readOnly || pending} aria-label={t("activeLabel", { name: user.name })} />;

  return (
    <TableRow className={cn(!user.active && "text-muted-foreground")}>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="max-w-40 truncate font-medium text-foreground sm:max-w-56">
              {user.name}
              {isMe && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{t("you")}</span>}
            </p>
            <p className="max-w-40 truncate text-xs text-muted-foreground md:hidden">
              <bdi dir="ltr">{user.email}</bdi>
              <span className="sm:hidden"> · {tr(user.role)}</span>
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <bdi dir="ltr" className="block max-w-64 truncate">
          {user.email}
        </bdi>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant={user.role === "OWNER" ? "soft" : "secondary"}>{tr(user.role)}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {user.active ? (
            <ConfirmDialog
              trigger={toggle}
              title={t("deactivateTitle", { name: user.name })}
              body={t("deactivateBody")}
              confirmLabel={t("deactivate")}
              onConfirm={() => setActive(false)}
            />
          ) : (
            <Switch checked={false} disabled={readOnly || pending} onCheckedChange={() => setActive(true)} aria-label={t("activeLabel", { name: user.name })} />
          )}
          <span className="hidden text-sm sm:inline">{user.active ? t("active") : t("inactive")}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={readOnly} aria-label={t("editLabel", { name: user.name })}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" onClick={onPassword} disabled={readOnly} aria-label={t("resetLabel", { name: user.name })}>
            <KeyRound />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function staffError(t: ReturnType<typeof useTranslations>, error: string) {
  if (error === "lastOwner") return t("lastOwner");
  if (error === "staffLimit") return t("limitReached");
  return t("saveFailed");
}

function RoleSelect({ id, value, onChange, error }: { id: string; value: Role; onChange: (r: Role) => void; error?: string }) {
  const tr = useTranslations("roles");
  const t = useTranslations("settings.staff");
  return (
    <Field label={t("role")} htmlFor={id} error={error} hint={t(`roleHint.${value}`)}>
      <NativeSelect {...fieldAria(id, error)} value={value} onChange={(e) => onChange(e.target.value as Role)}>
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {tr(r)}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("settings.staff");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({ name: "", email: "", role: "CASHIER" as Role, password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.name.trim()) local.name = "required";
    if (!v.email.trim()) local.email = "required";
    if (v.password.length < 8) local.password = "passwordTooShort";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const res = await createStaff(v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.fieldErrors ? null : staffError(t, res.error));
        return;
      }
      toast.success(t("created", { name: v.name.trim() }));
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Field label={t("name")} htmlFor="st-name" error={errors.name}>
            <Input {...fieldAria("st-name", errors.name)} autoFocus autoComplete="off" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label={t("email")} htmlFor="st-email" error={errors.email}>
            <Input
              {...fieldAria("st-email", errors.email)}
              type="email"
              dir="ltr"
              className="text-start"
              autoComplete="off"
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
            />
          </Field>
          <RoleSelect id="st-role" value={v.role} onChange={(role) => setV({ ...v, role })} error={errors.role} />
          <Field label={t("tempPassword")} htmlFor="st-password" error={errors.password} hint={t("tempPasswordHint")}>
            <PasswordInput {...fieldAria("st-password", errors.password)} generate value={v.password} onValueChange={(password) => setV({ ...v, password })} />
          </Field>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ user, isMe, onClose }: { user: Staff; isMe: boolean; onClose: () => void }) {
  const t = useTranslations("settings.staff");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: "required" });
    startTransition(async () => {
      const res = await updateStaff(user.id, { name, role, active: user.active });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.fieldErrors ? null : staffError(t, res.error));
        return;
      }
      toast.success(t("updated", { name: name.trim() }));
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>
            <bdi dir="ltr">{user.email}</bdi> · {t("since", { date: format.dateTime(user.createdAt, { dateStyle: "medium" }) })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Field label={t("name")} htmlFor="se-name" error={errors.name}>
            <Input {...fieldAria("se-name", errors.name)} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <RoleSelect id="se-role" value={role} onChange={setRole} error={errors.role} />
          {isMe && role !== "OWNER" && (
            <p role="status" className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
              {t("demoteSelf")}
            </p>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: Staff; onClose: () => void }) {
  const t = useTranslations("settings.staff");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("passwordTooShort");
    startTransition(async () => {
      const res = await resetStaffPassword(user.id, password);
      if (!res.ok) return setError(res.fieldErrors?.password ?? "generic");
      toast.success(t("passwordReset", { name: user.name }));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("resetTitle", { name: user.name })}</DialogTitle>
          <DialogDescription>{t("resetDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label={t("newPassword")} htmlFor="sp-password" error={error} hint={t("tempPasswordHint")}>
            <PasswordInput {...fieldAria("sp-password", error)} autoFocus generate value={password} onValueChange={setPassword} />
          </Field>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : t("resetSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
