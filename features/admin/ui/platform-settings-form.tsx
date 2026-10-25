"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { updatePlatformSettings } from "@/features/admin/actions";

type Settings = { appName: string; contactWhatsapp: string; contactEmail: string; showcaseShopSlug: string };

/** Super admin: product name, landing-page contact and the demo shop shown on the landing page. */
export function PlatformSettingsForm({ settings, shops }: { settings: Settings; shops: { slug: string; name: string }[] }) {
  const t = useTranslations("admin.platform");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = (Object.keys(form) as (keyof Settings)[]).some((k) => form[k] !== settings[k]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.appName.trim()) return setErrors({ appName: "required" });
    startTransition(async () => {
      try {
        const res = await updatePlatformSettings(form);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          if (!res.fieldErrors) toast.error(te("generic"));
          return;
        }
        setErrors({});
        toast.success(t("saved"));
        router.refresh();
      } catch {
        toast.error(te("generic"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <SectionCard title={t("brandTitle")} description={t("brandDescription")}>
        <div className="flex flex-col gap-5">
          <Field label={t("appName")} htmlFor="pf-app-name" hint={t("appNameHint")} error={errors.appName}>
            <Input {...fieldAria("pf-app-name", errors.appName)} autoFocus maxLength={60} value={form.appName} onChange={set("appName")} />
          </Field>
          <Field label={t("showcase")} htmlFor="pf-showcase" hint={t("showcaseHint")} error={errors.showcaseShopSlug}>
            <NativeSelect {...fieldAria("pf-showcase", errors.showcaseShopSlug)} value={form.showcaseShopSlug} onChange={set("showcaseShopSlug")}>
              <option value="">{t("showcaseNone")}</option>
              {shops.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name} ({s.slug})
                </option>
              ))}
            </NativeSelect>
          </Field>
          {form.showcaseShopSlug && (
            <p role="status" className="-mt-2 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("showcaseWarning")}
            </p>
          )}
        </div>
      </SectionCard>
      <SectionCard title={t("contactTitle")} description={t("contactDescription")}>
        <div className="flex flex-col gap-5">
          <Field label={t("whatsapp")} htmlFor="pf-whatsapp" optional hint={t("whatsappHint")} error={errors.contactWhatsapp}>
            <Input
              {...fieldAria("pf-whatsapp", errors.contactWhatsapp)}
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="text-start tabular-nums"
              maxLength={30}
              value={form.contactWhatsapp}
              onChange={set("contactWhatsapp")}
            />
          </Field>
          <Field label={t("email")} htmlFor="pf-email" optional hint={t("emailHint")} error={errors.contactEmail}>
            <Input
              {...fieldAria("pf-email", errors.contactEmail)}
              type="email"
              dir="ltr"
              className="text-start"
              maxLength={120}
              value={form.contactEmail}
              onChange={set("contactEmail")}
            />
          </Field>
        </div>
      </SectionCard>
      <div className="flex justify-end lg:col-span-2">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </div>
    </form>
  );
}
