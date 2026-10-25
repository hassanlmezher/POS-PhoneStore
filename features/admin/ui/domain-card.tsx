"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, CircleAlert, Globe, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { setupShopDomain } from "@/features/admin/actions";
import type { DomainStatus } from "@/lib/domains";

/** Shop web address (<slug>.domain) on Vercel + Cloudflare, with a button to (re)create it. */
export function DomainCard({ shopId, status }: { shopId: string; status: DomainStatus }) {
  const t = useTranslations("admin.domain");
  const router = useRouter();
  const [pending, start] = useTransition();
  const ready = status.vercel === "ok" && status.dns === "ok";

  function setup() {
    start(async () => {
      const res = await setupShopDomain(shopId);
      if (!res.ok) return void toast.error(t("failed"));
      if (res.domain.status === "ok") toast.success(t("done"));
      else if (res.domain.status === "skipped") toast.message(t("notConfigured"));
      else toast.error(t("failedDetail", { detail: res.domain.detail ?? "" }));
      router.refresh();
    });
  }

  const line = (label: string, ok: boolean, text: string) => (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? "inline-flex items-center gap-1 text-success" : "inline-flex items-center gap-1 text-warning"}>
        {ok ? <CircleCheck className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
        {text}
      </span>
    </li>
  );

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 font-medium">
          <Globe className="size-4 text-muted-foreground" aria-hidden />
          <bdi dir="ltr">{status.host}</bdi>
        </p>
        {status.configured ? (
          <ul className="flex flex-col gap-2">
            {line(t("vercel"), status.vercel === "ok", t(`vercelState.${status.vercel}`))}
            {line(t("dns"), status.dns === "ok", t(`dnsState.${status.dns}`))}
            {line(t("live"), status.live, status.live ? t("liveYes") : t("liveNo"))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>
        )}
        {status.configured && ready && (
          <p className="text-xs text-muted-foreground">{status.live ? t("cacheHint") : t("startingHint")}</p>
        )}
        {status.configured && ready && !status.live && (
          <Button variant="outline" onClick={() => router.refresh()} className="w-full">
            <RefreshCw />
            {t("checkAgain")}
          </Button>
        )}
        {status.configured && !ready && (
          <Button onClick={setup} disabled={pending} className="w-full">
            {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t("setup")}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
