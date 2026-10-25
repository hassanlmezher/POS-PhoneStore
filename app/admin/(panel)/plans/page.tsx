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
                <TableHead className="hidden text-end sm:table-cell">{t("maxStaff")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("shops")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("status")}</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="w-full max-w-0 font-medium sm:w-auto sm:max-w-none">
                    <span className="block truncate">{p.name}</span>
                    {/* Status sits under the name on phones (its column is hidden). */}
                    <Badge variant={p.active ? "success" : "secondary"} className="mt-1 flex w-fit sm:hidden">
                      {p.active ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    <bdi dir="ltr" className="tabular-nums">
                      {formatMoney(p.priceUsdCents, "USD")}
                    </bdi>
                    <span className="text-xs text-muted-foreground"> {t("perMonth")}</span>
                  </TableCell>
                  <TableCell className="hidden text-end tabular-nums sm:table-cell">{p.maxStaff ?? t("unlimited")}</TableCell>
                  <TableCell className="hidden text-end tabular-nums md:table-cell">{p._count.shops}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={p.active ? "success" : "secondary"}>{p.active ? t("active") : t("inactive")}</Badge>
                  </TableCell>
                  <TableCell className="ps-0 sm:ps-4">
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
