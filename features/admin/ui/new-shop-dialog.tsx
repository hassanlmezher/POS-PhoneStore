"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, ExternalLink, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { Field, fieldAria } from "@/components/field";
import { PasswordInput } from "@/components/password-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { checkShopLive, createShop } from "@/features/admin/actions";
import { formatMoney } from "@/lib/money";
import { slugHint, slugify } from "./slug";

type Plan = { id: string; name: string; priceUsdCents: number };
type Props = { rootDomain: string; protocol: string; plans: Plan[] };

export function NewShopButton(props: Props) {
  const t = useTranslations("admin.newShop");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {t("button")}
      </Button>
      {open && <NewShopDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewShopDialog({ rootDomain, protocol, plans, onClose }: Props & { onClose: () => void }) {
  const t = useTranslations("admin.newShop");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const td = useTranslations("admin.domain");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    name: "",
    slug: "",
    planId: plans[0]?.id ?? "",
    trialDays: "14",
    defaultLocale: "EN" as "EN" | "AR",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ id: string; url: string; email: string; password: string; live: boolean } | null>(null);

  // Don't show "Open shop" until the address answers: opening (or prefetching) it earlier makes the
  // user's network cache the old wildcard answer ("Unknown host") for ~5 minutes.
  useEffect(() => {
    if (!created || created.live) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      const { live } = await checkShopLive(created.id).catch(() => ({ live: false }));
      if (stop) return;
      if (live || Date.now() - started > 5 * 60_000) setCreated((c) => (c ? { ...c, live: true } : c));
      else setTimeout(tick, 5000);
    };
    const first = setTimeout(tick, 4000);
    return () => {
      stop = true;
      clearTimeout(first);
    };
  }, [created]);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((p) => ({ ...p, [k]: value }));

  const hint = slugHint(v.slug);
  const url = `${protocol}://${v.slug || "…"}.${rootDomain}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.name.trim()) local.name = "required";
    if (hint) local.slug = hint;
    if (!v.ownerName.trim()) local.ownerName = "required";
    if (!v.ownerEmail.trim()) local.ownerEmail = "required";
    if (v.ownerPassword.length < 8) local.ownerPassword = "passwordTooShort";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const res = await createShop(v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(te("generic"));
        return;
      }
      toast.success(t("created", { name: v.name.trim() }));
      if (res.domain.status === "ok") toast.success(td("autoOk"));
      else if (res.domain.status === "error") toast.warning(td("failedDetail", { detail: res.domain.detail ?? "" }));
      setCreated({
        id: res.id,
        url: `${protocol}://${res.slug}.${rootDomain}`,
        email: v.ownerEmail.trim().toLowerCase(),
        password: v.ownerPassword,
        live: res.domain.status !== "ok",
      });
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc("close")} className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        {created ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-success-soft text-success">
                <CircleCheck className="size-6" aria-hidden />
              </div>
              <DialogTitle>{t("doneTitle")}</DialogTitle>
              <DialogDescription>{t("doneBody")}</DialogDescription>
            </DialogHeader>
            <dl className="flex flex-col gap-3">
              {(
                [
                  [t("shopUrl"), created.url],
                  [t("ownerEmail"), created.email],
                  [t("ownerPassword"), created.password],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <dt className="text-sm font-medium">{label}</dt>
                  <dd className="flex gap-2">
                    <Input readOnly value={value} dir="ltr" className="text-start font-mono" onFocus={(e) => e.target.select()} />
                    <CopyButton value={value} label={t("copyLabel", { what: label })} />
                  </dd>
                </div>
              ))}
            </dl>
            {!created.live && (
              <p role="status" className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                {td("waiting")}
              </p>
            )}
            <DialogFooter className="pt-2">
              {created.live ? (
                <Button variant="outline" asChild>
                  <a href={created.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="rtl:-scale-x-100" />
                    {t("openShop")}
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Loader2 className="animate-spin" />
                  {td("liveNo")}
                </Button>
              )}
              <Button onClick={onClose}>{t("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <Field label={t("name")} htmlFor="ns-name" error={errors.name}>
                <Input
                  {...fieldAria("ns-name", errors.name)}
                  autoFocus
                  autoComplete="off"
                  value={v.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!slugTouched) set("slug", slugify(e.target.value));
                  }}
                />
              </Field>
              <Field
                label={t("slug")}
                htmlFor="ns-slug"
                error={errors.slug ?? (v.slug && hint ? hint : null)}
                hint={
                  <>
                    {t("urlWillBe")} <bdi dir="ltr" className="font-medium text-foreground">{url}</bdi>
                  </>
                }
              >
                <Input
                  {...fieldAria("ns-slug", errors.slug ?? (v.slug && hint ? hint : null))}
                  dir="ltr"
                  className="text-start font-mono"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                  value={v.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("plan")} htmlFor="ns-plan" error={errors.planId}>
                  <NativeSelect {...fieldAria("ns-plan", errors.planId)} value={v.planId} onChange={(e) => set("planId", e.target.value)}>
                    <option value="">{t("noPlan")}</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatMoney(p.priceUsdCents, "USD")}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={t("trialDays")} htmlFor="ns-trial" error={errors.trialDays}>
                  <Input
                    {...fieldAria("ns-trial", errors.trialDays)}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={365}
                    dir="ltr"
                    className="text-start tabular-nums"
                    value={v.trialDays}
                    onChange={(e) => set("trialDays", e.target.value)}
                  />
                </Field>
              </div>
              <Field label={t("language")} htmlFor="ns-locale">
                <Segmented
                  id="ns-locale"
                  label={t("language")}
                  value={v.defaultLocale}
                  onValueChange={(l) => set("defaultLocale", l)}
                  options={[
                    { value: "EN", label: tc("english") },
                    { value: "AR", label: tc("arabic") },
                  ]}
                  className="w-full sm:w-64"
                />
              </Field>

              <Separator className="my-1" />
              <p className="text-sm font-semibold">{t("ownerSection")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("ownerName")} htmlFor="ns-owner" error={errors.ownerName}>
                  <Input {...fieldAria("ns-owner", errors.ownerName)} autoComplete="off" value={v.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
                </Field>
                <Field label={t("ownerEmail")} htmlFor="ns-email" error={errors.ownerEmail}>
                  <Input
                    {...fieldAria("ns-email", errors.ownerEmail)}
                    type="email"
                    dir="ltr"
                    className="text-start"
                    autoComplete="off"
                    value={v.ownerEmail}
                    onChange={(e) => set("ownerEmail", e.target.value)}
                  />
                </Field>
              </div>
              <Field label={t("ownerPassword")} htmlFor="ns-password" error={errors.ownerPassword} hint={t("passwordHint")}>
                <PasswordInput {...fieldAria("ns-password", errors.ownerPassword)} generate value={v.ownerPassword} onValueChange={(p) => set("ownerPassword", p)} />
              </Field>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? t("creating") : t("submit")}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
