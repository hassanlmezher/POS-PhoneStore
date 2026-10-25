"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateShopBasics } from "@/features/admin/actions";
import { slugHint } from "./slug";

export function ShopBasicsForm({ shop, rootDomain, protocol }: { shop: { id: string; name: string; slug: string }; rootDomain: string; protocol: string }) {
  const t = useTranslations("admin.shop");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(shop.name);
  const [slug, setSlug] = useState(shop.slug);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hint = slugHint(slug);
  const slugChanged = slug !== shop.slug;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "required";
    if (hint) local.slug = hint;
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const res = await updateShopBasics(shop.id, { name, slug });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(te("generic"));
        return;
      }
      toast.success(t("basicsSaved"));
      router.refresh();
    });
  }

  const slugError = errors.slug ?? (slugChanged && hint ? hint : null);
  return (
    <SectionCard title={t("basicsTitle")}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t("name")} htmlFor="sb-name" error={errors.name}>
          <Input {...fieldAria("sb-name", errors.name)} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label={t("slug")}
          htmlFor="sb-slug"
          error={slugError}
          hint={
            <>
              {t("url")} <bdi dir="ltr" className="font-medium text-foreground">{`${protocol}://${slug || "…"}.${rootDomain}`}</bdi>
            </>
          }
        >
          <Input
            {...fieldAria("sb-slug", slugError)}
            dir="ltr"
            className="text-start font-mono"
            spellCheck={false}
            maxLength={32}
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          />
        </Field>
        {slugChanged && (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("slugWarning")}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || (name === shop.name && !slugChanged)}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
