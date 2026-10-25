import { getTranslations } from "next-intl/server";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPlans } from "@/features/admin/queries";
import { PlanDialogButton } from "@/features/admin/ui/plan-dialog";
import { formatMoney } from "@/lib/money";

export default async function AdminPlansPage() {
  const [t, plans] = await Promise.all([getTranslations("admin.plans"), listPlans()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<PlanDialogButton />} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {plans.length === 0 ? (
          <EmptyState icon={Layers} title={t("empty")} body={t("emptyBody")} action={<PlanDialogButton />} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="text-end">{t("price")}</TableHead>
                <TableHead className="text-end">{t("maxStaff")}</TableHead>
                <TableHead className="text-end">{t("shops")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-end">
                    <bdi dir="ltr" className="tabular-nums">
                      {formatMoney(p.priceUsdCents, "USD")}
                    </bdi>
                    <span className="text-xs text-muted-foreground"> {t("perMonth")}</span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{p.maxStaff ?? t("unlimited")}</TableCell>
                  <TableCell className="text-end tabular-nums">{p._count.shops}</TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "success" : "secondary"}>{p.active ? t("active") : t("inactive")}</Badge>
                  </TableCell>
                  <TableCell>
                    <PlanDialogButton plan={{ id: p.id, name: p.name, priceUsdCents: p.priceUsdCents, maxStaff: p.maxStaff, active: p.active }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
