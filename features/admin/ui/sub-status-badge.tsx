import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { EffectiveStatus } from "@/lib/subscription";

const variant = { TRIAL: "soft", ACTIVE: "success", EXPIRED: "warning", SUSPENDED: "destructive" } as const;

/** Subscription status pill (effective status: accounts for passed trial/paid dates). */
export function SubStatusBadge({ status }: { status: EffectiveStatus }) {
  const t = useTranslations("admin.subStatus");
  return <Badge variant={variant[status]}>{t(status)}</Badge>;
}
