"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteShop } from "@/features/admin/actions";

/** Danger zone: permanently delete a shop (and its web address). Requires typing the slug. */
export function DeleteShopCard({ shop }: { shop: { id: string; slug: string; name: string } }) {
  const t = useTranslations("admin.deleteShop");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const matches = confirm.trim().toLowerCase() === shop.slug;

  function run() {
    start(async () => {
      const res = await deleteShop(shop.id, confirm);
      if (!res.ok) {
        toast.error(res.error === "showcaseShop" ? t("showcase") : t("failed"));
        return;
      }
      if (res.domain.status === "error") toast.warning(t("domainLeft", { detail: res.domain.detail ?? "" }));
      toast.success(t("deleted", { name: shop.name }));
      router.push("/");
    });
  }

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <Button variant="destructive" className="w-full" onClick={() => setOpen(true)}>
        <Trash2 />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (setOpen(o), setConfirm(""))}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle", { name: shop.name })}</DialogTitle>
            <DialogDescription>{t("confirmBody")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirm">{t("typeSlug", { slug: shop.slug })}</Label>
            <Input id="delete-confirm" dir="ltr" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" disabled={!matches || pending} onClick={run}>
              {pending && <Loader2 className="animate-spin" />}
              {t("button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
