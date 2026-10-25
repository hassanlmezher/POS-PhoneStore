"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, KeyRound, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { PatternGrid } from "@/components/pattern-grid";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { revealPasscode, setTicketPasscode, type LockChange } from "@/features/tickets/actions";
import { isValidPattern } from "@/features/tickets/schema";

type Props = { ticketId: string; hasPasscode: boolean; hasPattern: boolean; canEdit: boolean };

/** Hidden by default; every reveal is audit-logged on the server. */
export function PasscodePanel({ ticketId, hasPasscode, hasPattern, canEdit }: Props) {
  const t = useTranslations("ticket");
  const tc = useTranslations("common");
  const ti = useTranslations("intake");
  const te = useTranslations("errors");
  const [revealed, setRevealed] = useState<{ passcode: string | null; pattern: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [kind, setKind] = useState<"passcode" | "pattern">(hasPattern ? "pattern" : "passcode");
  const [passcode, setPasscode] = useState("");
  const [pattern, setPattern] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasAny = hasPasscode || hasPattern;

  function reveal() {
    startTransition(async () => {
      try {
        const res = await revealPasscode(ticketId);
        if (!res.ok) return void toast.error(t("revealFailed"));
        setRevealed({ passcode: res.passcode, pattern: res.pattern });
      } catch {
        toast.error(t("revealFailed"));
      }
    });
  }

  /** Fresh, empty form every time: the old lock is only replaced once a new one is entered. */
  function openEdit() {
    setKind(hasPattern ? "pattern" : "passcode");
    setPasscode("");
    setPattern("");
    setError(null);
    setEditOpen(true);
  }

  function apply(change: LockChange, successKey: "passcodeSaved" | "lockRemoved") {
    startTransition(async () => {
      try {
        const res = await setTicketPasscode(ticketId, change);
        if (!res.ok) return void toast.error(t("saveFailed"));
        toast.success(t(successKey));
        setRevealed(null);
        setEditOpen(false);
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "passcode" && !passcode.trim()) return setError("required");
    if (kind === "pattern" && !isValidPattern(pattern)) return setError("patternTooShort");
    apply(kind === "passcode" ? { kind, value: passcode.trim() } : { kind, value: pattern }, "passcodeSaved");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound aria-hidden className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {hasPattern ? t("hasPattern") : hasPasscode ? t("hasPasscode") : t("noLock")}
        </span>
        <div className="ms-auto flex gap-1">
          {hasAny &&
            (revealed ? (
              <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
                <EyeOff />
                {t("hide")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={reveal} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Eye />}
                {t("reveal")}
              </Button>
            ))}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={openEdit}>
              <Pencil />
              {hasAny ? tc("change") : tc("add")}
            </Button>
          )}
        </div>
      </div>
      {hasAny && !revealed && <p className="text-xs text-subtle-foreground">{t("revealLogged")}</p>}
      {revealed && (
        <div className="flex flex-wrap items-start gap-4 rounded-lg border bg-muted/30 p-3">
          {revealed.passcode && (
            <p className="font-mono text-lg font-semibold tracking-wider" dir="ltr">
              {revealed.passcode}
            </p>
          )}
          {revealed.pattern && <PatternGrid value={revealed.pattern} readOnly size="sm" />}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("changeLock")}</DialogTitle>
            <DialogDescription>{t("changeLockBody")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <Segmented
              label={ti("screenLock")}
              value={kind}
              onValueChange={(v) => {
                setKind(v);
                setError(null);
              }}
              options={[
                { value: "passcode", label: ti("lockPasscode") },
                { value: "pattern", label: ti("lockPattern") },
              ]}
              className="w-full"
            />
            {kind === "passcode" && (
              <Field label={ti("passcode")} htmlFor="edit-passcode" error={error ?? undefined}>
                <Input
                  id="edit-passcode"
                  autoFocus
                  dir="ltr"
                  autoComplete="off"
                  className="text-start"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setError(null);
                  }}
                />
              </Field>
            )}
            {kind === "pattern" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">{ti("patternHint")}</p>
                <PatternGrid
                  value={pattern}
                  onChange={(v) => {
                    setPattern(v);
                    setError(null);
                  }}
                />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {te(error)}
                  </p>
                )}
              </div>
            )}
            <DialogFooter className="sm:justify-between">
              {hasAny ? (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}>
                      {t("removeLock")}
                    </Button>
                  }
                  title={t("removeLockTitle")}
                  body={t("removeLockBody")}
                  confirmLabel={t("removeLock")}
                  onConfirm={() => apply({ kind: "none" }, "lockRemoved")}
                />
              ) : (
                <span />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {tc("save")}
              </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
