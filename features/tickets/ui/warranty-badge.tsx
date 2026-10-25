import { useFormatter, useTranslations } from "next-intl";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function isPast(d: Date) {
  return d.getTime() < Date.now();
}

/** Warranty state of a ticket. `until` comes from `warrantyUntil()`; null = not started (not picked up yet). */
export function WarrantyBadge({ until, showNotStarted = false }: { until: Date | null; showNotStarted?: boolean }) {
  const t = useTranslations("warranty");
  const format = useFormatter();
  if (!until) return showNotStarted ? <Badge variant="secondary">{t("notStarted")}</Badge> : null;
  if (isPast(until))
    return (
      <Badge variant="secondary">
        <ShieldOff aria-hidden />
        {t("expired")}
      </Badge>
    );
  return (
    <Badge variant="success">
      <ShieldCheck aria-hidden />
      {t("activeUntil", { date: format.dateTime(until, { dateStyle: "medium" }) })}
    </Badge>
  );
}
