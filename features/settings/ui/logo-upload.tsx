"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { removeLogo, uploadLogo } from "@/features/settings/actions";
import { initials } from "@/components/app-shell/shop-mark";

const MAX_BYTES = 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Logo card: preview, upload/replace (PNG/JPG/WEBP ≤ 1 MB) and remove. */
export function LogoUpload({ logoUrl, shopName, readOnly }: { logoUrl: string | null; shopName: string; readOnly: boolean }) {
  const t = useTranslations("settings.logo");
  const te = useTranslations("errors");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    // Quick client checks; the server re-checks the real bytes.
    if (file.size > MAX_BYTES) return setError("tooLarge");
    if (!TYPES.includes(file.type)) return setError("badType");
    const fd = new FormData();
    fd.set("logo", file);
    startTransition(async () => {
      const res = await uploadLogo(fd);
      if (input.current) input.current.value = "";
      if (!res.ok) return setError(res.error);
      toast.success(t("uploaded"));
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeLogo();
      if (!res.ok) return void toast.error(te("generic"));
      toast.success(t("removed"));
      router.refresh();
    });
  }

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-32 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local, versioned file route
            <img src={logoUrl} alt={t("previewAlt", { shop: shopName })} className="size-full object-contain p-2" />
          ) : (
            <span aria-hidden className="text-3xl font-semibold text-subtle-foreground">
              {initials(shopName)}
            </span>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex w-full flex-col gap-2">
          <Button type="button" variant="outline" disabled={pending || readOnly} onClick={() => input.current?.click()}>
            <ImageUp />
            {pending ? t("uploading") : logoUrl ? t("replace") : t("upload")}
          </Button>
          {logoUrl && (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending || readOnly}>
                  <Trash2 />
                  {t("remove")}
                </Button>
              }
              title={t("removeTitle")}
              body={t("removeBody")}
              confirmLabel={t("remove")}
              onConfirm={remove}
            />
          )}
        </div>
        <p role={error ? "alert" : undefined} className={error ? "text-center text-xs text-destructive" : "text-center text-xs text-muted-foreground"}>
          {error ? (te.has(error) ? te(error) : te("generic")) : t("hint")}
        </p>
      </div>
    </SectionCard>
  );
}
