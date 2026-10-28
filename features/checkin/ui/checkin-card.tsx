"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Camera, Check, CheckCheck, Loader2, Minus, PenLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteTicketMedia, saveChecklist, saveSignature, uploadTicketPhoto } from "@/features/checkin/actions";
import { CHECKLIST_ITEMS, MAX_PHOTOS, type Checklist, type CheckValue } from "@/features/checkin/rules";
import { cn } from "@/lib/utils";

type Media = { id: string; url: string };
type Props = {
  ticketId: string;
  photos: Media[];
  signature: (Media & { at: string }) | null;
  checklist: Checklist;
  canEdit: boolean;
};

/** Shrinks a camera photo on the device (longest side 1600 px, JPEG) so uploads stay small and fast. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.8));
}

const VALUE_STYLE: Record<CheckValue, { icon: typeof Check; on: string }> = {
  ok: { icon: Check, on: "border-success bg-success-soft text-success" },
  issue: { icon: X, on: "border-destructive bg-destructive-soft text-destructive" },
  na: { icon: Minus, on: "border-foreground/30 bg-muted text-foreground" },
};

/** Check-in proof: photos of the phone, a quick condition checklist, and the customer's signature. */
export function CheckinCard({ ticketId, photos, signature, checklist, canEdit }: Props) {
  const t = useTranslations("checkin");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [checks, setChecks] = useState<Checklist>(checklist);
  const [viewing, setViewing] = useState<Media | null>(null);
  const [signing, setSigning] = useState(false);
  const [, startTransition] = useTransition();
  const left = MAX_PHOTOS - photos.length;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, left);
    if (files.length > left) toast.warning(t("tooMany", { max: MAX_PHOTOS }));
    setUploading({ done: 0, total: list.length });
    let failed = 0;
    for (const [i, file] of list.entries()) {
      try {
        const fd = new FormData();
        fd.append("file", await shrink(file), "photo.jpg");
        const res = await uploadTicketPhoto(ticketId, fd);
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    if (failed) toast.error(t("uploadFailed", { count: failed }));
    else toast.success(t("photosAdded", { count: list.length }));
    router.refresh();
  }

  function setCheck(next: Checklist) {
    const prev = checks;
    setChecks(next);
    startTransition(async () => {
      const res = await saveChecklist(ticketId, next);
      if (!res.ok) {
        setChecks(prev);
        toast.error(te("generic"));
      }
    });
  }

  function removePhoto(id: string) {
    startTransition(async () => {
      const res = await deleteTicketMedia(id);
      if (!res.ok) return void toast.error(te("generic"));
      setViewing(null);
      router.refresh();
    });
  }

  const issues = CHECKLIST_ITEMS.filter((k) => checks[k] === "issue").length;

  return (
    <section id="checkin" aria-labelledby="checkin-title" className="scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
        <div>
          <h2 id="checkin-title" className="font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* Photos */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t("photos", { count: photos.length, max: MAX_PHOTOS })}</h3>
            {canEdit && left > 0 && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="sr-only"
                  aria-label={t("addPhotos")}
                  onChange={(e) => void addPhotos(e.target.files)}
                />
                <Button type="button" variant="outline" size="sm" className="h-10" disabled={!!uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
                  {uploading ? t("uploading", { done: uploading.done, total: uploading.total }) : t("addPhotos")}
                </Button>
              </>
            )}
          </div>
          {photos.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("noPhotos")}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(p)}
                    className="block aspect-square w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    aria-label={t("openPhoto", { n: i + 1 })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
                    <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Checklist */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {t("checklist")}
              {issues > 0 && <span className="ms-2 rounded-full bg-destructive-soft px-2 py-0.5 text-xs text-destructive">{t("issues", { count: issues })}</span>}
            </h3>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => setCheck(Object.fromEntries(CHECKLIST_ITEMS.map((k) => [k, checks[k] ?? "ok"])) as Checklist)}
              >
                <CheckCheck />
                {t("restOk")}
              </Button>
            )}
          </div>
          <ul className="flex flex-col divide-y rounded-lg border">
            {CHECKLIST_ITEMS.map((k) => (
              <li key={k} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="min-w-0 text-sm">{t(`items.${k}`)}</span>
                <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={t(`items.${k}`)}>
                  {(["ok", "issue", "na"] as const).map((v) => {
                    const on = checks[k] === v;
                    const Icon = VALUE_STYLE[v].icon;
                    return (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={!canEdit}
                        title={t(`values.${v}`)}
                        aria-label={t(`values.${v}`)}
                        onClick={() => setCheck({ ...checks, [k]: v })}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-lg border text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-default",
                          on ? VALUE_STYLE[v].on : "bg-card hover:bg-accent",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Signature */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t("signature")}</h3>
            {canEdit && (
              <Button type="button" variant={signature ? "ghost" : "default"} size="sm" className="h-10" onClick={() => setSigning(true)}>
                <PenLine />
                {signature ? t("signAgain") : t("sign")}
              </Button>
            )}
          </div>
          {signature ? (
            <div className="rounded-lg border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
              <img src={signature.url} alt={t("signatureAlt")} className="mx-auto h-24 object-contain" />
              <p className="text-center text-xs text-gray-500">{t("signedOn", { date: format.dateTime(new Date(signature.at), { dateStyle: "medium", timeStyle: "short" }) })}</p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("notSigned")}</p>
          )}
        </div>
      </div>

      {/* Photo viewer */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("photo")}</DialogTitle>
            <DialogDescription className="sr-only">{t("hint")}</DialogDescription>
          </DialogHeader>
          {viewing && (
            // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route
            <img src={viewing.url} alt="" className="max-h-[70vh] w-full rounded-lg object-contain" />
          )}
          {canEdit && viewing && (
            <DialogFooter>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 />
                    {t("deletePhoto")}
                  </Button>
                }
                title={t("deleteTitle")}
                body={t("deleteBody")}
                confirmLabel={t("deletePhoto")}
                onConfirm={() => removePhoto(viewing.id)}
              />
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {signing && <SignDialog ticketId={ticketId} onClose={() => setSigning(false)} />}
    </section>
  );
}

function SignDialog({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const t = useTranslations("checkin");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const pad = useRef<SignaturePadHandle>(null);
  const [drawn, setDrawn] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const blob = await pad.current?.toBlob();
      if (!blob) return;
      const fd = new FormData();
      fd.append("file", blob, "signature.png");
      const res = await saveSignature(ticketId, fd);
      if (!res.ok) return void toast.error(te("generic"));
      toast.success(t("signed"));
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("signTitle")}</DialogTitle>
          <DialogDescription>{t("signText")}</DialogDescription>
        </DialogHeader>
        <SignaturePad ref={pad} label={t("signHere")} onDrawnChange={setDrawn} />
        <p className="-mt-2 text-center text-xs text-muted-foreground">{t("signHere")}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => pad.current?.clear()} disabled={!drawn}>
            {t("clear")}
          </Button>
          <Button variant="outline" type="button" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={!drawn || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t("saveSignature")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
