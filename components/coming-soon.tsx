import { useTranslations } from "next-intl";
import { Construction, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

/** Placeholder card for sections built in a later phase. */
export function ComingSoon({ icon = Construction, className }: { icon?: LucideIcon; className?: string }) {
  const t = useTranslations("common");
  return (
    <div className={cn("rounded-xl border border-dashed bg-card/60", className)}>
      <EmptyState icon={icon} title={t("comingSoon")} body={t("comingSoonBody")} className="py-20" />
    </div>
  );
}
