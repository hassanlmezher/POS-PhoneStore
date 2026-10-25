"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Banknote, Check, HandCoins, Loader2, Pencil, Plus, Trash2, Wrench, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deletePreset, movePreset, savePreset } from "@/features/settings/actions";
import type { PRESET_KINDS } from "@/features/settings/schema";
import { cn } from "@/lib/utils";

type Kind = (typeof PRESET_KINDS)[number];
export type QuickPick = { id: string; labelEn: string; labelAr: string };

const ICONS: Record<Kind, LucideIcon> = { PROBLEM: Wrench, PAY_IN: HandCoins, PAY_OUT: Banknote };

/** Settings → Quick picks: problem chips on intake and pay in/out reasons on the cash drawer. */
export function QuickPicks({ lists, readOnly }: { lists: Record<Kind, QuickPick[]>; readOnly: boolean }) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      {(["PROBLEM", "PAY_IN", "PAY_OUT"] as const).map((kind) => (
        <PickList key={kind} kind={kind} items={lists[kind]} readOnly={readOnly} />
      ))}
    </div>
  );
}

function useAction() {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>, success?: string, onOk?: () => void) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error && te.has(res.error) ? te(res.error as never) : t("saveFailed"));
          return;
        }
        if (success) toast.success(success);
        onOk?.();
        router.refresh();
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }
  return { pending, run };
}

function PickList({ kind, items, readOnly }: { kind: Kind; items: QuickPick[]; readOnly: boolean }) {
  const t = useTranslations("settings.quickPicks");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const headingId = `qp-${kind}`;

  return (
    <SectionCard
      id={headingId}
      title={t(`kinds.${kind}.title`)}
      description={t(`kinds.${kind}.description`)}
      padded={false}
      actions={
        !readOnly &&
        !adding && (
          <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => setAdding(true)}>
            <Plus />
            {t("add")}
          </Button>
        )
      }
    >
      {items.length === 0 && !adding ? (
        <EmptyState icon={ICONS[kind]} title={t("emptyTitle")} body={t(`kinds.${kind}.empty`)} className="py-10" />
      ) : (
        <ol className="divide-y" aria-labelledby={`${headingId}-title`}>
          {items.map((item, i) =>
            editing === item.id ? (
              <li key={item.id} className="p-3 sm:px-4">
                <PickForm kind={kind} item={item} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <PickRow
                key={item.id}
                item={item}
                first={i === 0}
                last={i === items.length - 1}
                readOnly={readOnly}
                onEdit={() => {
                  setAdding(false);
                  setEditing(item.id);
                }}
              />
            ),
          )}
          {adding && (
            <li className="p-3 sm:px-4">
              <PickForm kind={kind} onDone={() => setAdding(false)} keepOpen />
            </li>
          )}
        </ol>
      )}
    </SectionCard>
  );
}

function PickRow({
  item,
  first,
  last,
  readOnly,
  onEdit,
}: {
  item: QuickPick;
  first: boolean;
  last: boolean;
  readOnly: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("settings.quickPicks");
  const { pending, run } = useAction();
  const name = item.labelEn || item.labelAr;
  return (
    <li className="flex min-h-14 items-center gap-2 py-1.5 ps-4 pe-2">
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", !item.labelEn && "text-subtle-foreground")} dir="ltr" lang="en">
          <bdi>{item.labelEn || t("missing")}</bdi>
        </p>
        <p className={cn("truncate text-sm text-muted-foreground", !item.labelAr && "text-subtle-foreground")} dir="rtl" lang="ar">
          {item.labelAr || t("missing")}
        </p>
      </div>
      {pending && <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />}
      {!readOnly && (
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="sm:size-9"
            disabled={first || pending}
            aria-label={t("moveUp", { name })}
            onClick={() => run(() => movePreset(item.id, "up"))}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="sm:size-9"
            disabled={last || pending}
            aria-label={t("moveDown", { name })}
            onClick={() => run(() => movePreset(item.id, "down"))}
          >
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="sm:size-9" disabled={pending} aria-label={t("edit", { name })} onClick={onEdit}>
            <Pencil />
          </Button>
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive sm:size-9" disabled={pending} aria-label={t("delete", { name })}>
                <Trash2 />
              </Button>
            }
            title={t("deleteTitle", { name })}
            body={t("deleteBody")}
            confirmLabel={t("deleteConfirm")}
            onConfirm={() => run(() => deletePreset(item.id), t("deleted", { name }))}
          />
        </div>
      )}
    </li>
  );
}

/** Inline add/edit row: EN + AR labels, Enter saves, Escape cancels. */
function PickForm({ kind, item, onDone, keepOpen }: { kind: Kind; item?: QuickPick; onDone: () => void; keepOpen?: boolean }) {
  const t = useTranslations("settings.quickPicks");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  const [en, setEn] = useState(item?.labelEn ?? "");
  const [ar, setAr] = useState(item?.labelAr ?? "");
  const [error, setError] = useState(false);
  const prefix = `qp-${kind}-${item?.id ?? "new"}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!en.trim() && !ar.trim()) return setError(true);
    setError(false);
    const name = en.trim() || ar.trim();
    run(
      () => savePreset(item?.id ?? null, { kind, labelEn: en, labelAr: ar }),
      item ? t("updated", { name }) : t("added", { name }),
      () => {
        if (keepOpen) {
          setEn("");
          setAr("");
          document.getElementById(`${prefix}-en`)?.focus();
        } else onDone();
      },
    );
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onDone()} noValidate className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${prefix}-en`} className="text-xs font-medium text-muted-foreground">
            {t("labelEn")}
          </label>
          <Input
            id={`${prefix}-en`}
            dir="ltr"
            lang="en"
            autoFocus
            autoComplete="off"
            maxLength={60}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${prefix}-msg` : undefined}
            value={en}
            onChange={(e) => setEn(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${prefix}-ar`} className="text-xs font-medium text-muted-foreground">
            {t("labelAr")}
          </label>
          <Input
            id={`${prefix}-ar`}
            dir="rtl"
            lang="ar"
            autoComplete="off"
            maxLength={60}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${prefix}-msg` : undefined}
            value={ar}
            onChange={(e) => setAr(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p id={`${prefix}-msg`} role="alert" className="text-xs text-destructive">
          {t("labelRequired")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-9" onClick={onDone}>
          <X />
          {tc("cancel")}
        </Button>
        <Button type="submit" size="sm" className="h-11 sm:h-9" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          {item ? tc("save") : t("add")}
        </Button>
      </div>
    </form>
  );
}
