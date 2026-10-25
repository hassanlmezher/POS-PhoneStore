import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight, Plus, SearchX, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrlSearchInput } from "@/components/url-search-input";
import { listCustomers } from "@/features/customers/queries";
import { CustomerDialogButton } from "@/features/customers/ui/customer-dialog";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { requireShop } from "@/lib/tenant";

export default async function CustomersPage({ params, searchParams }: PageProps<"/shop/[slug]/customers">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { db, shop, user, readOnly } = await requireShop(slug);
  const t = await getTranslations("customers");
  const format = await getFormatter();
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize } = await listCustomers(db, { q, page });
  const canAdd = can(user.role, "tickets.create") && !readOnly;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: total })}
        actions={
          canAdd && (
            <CustomerDialogButton>
              <Plus />
              {t("add")}
            </CustomerDialogButton>
          )
        }
      />

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="border-b p-3 sm:p-4">
          <UrlSearchInput basePath="/customers" label={t("search")} placeholder={t("searchPlaceholder")} className="sm:max-w-sm" />
        </div>

        {rows.length === 0 ? (
          q ? (
            <EmptyState icon={SearchX} title={t("noResults")} body={t("noResultsBody", { q })} />
          ) : (
            <EmptyState
              icon={Users}
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={
                canAdd && (
                  <CustomerDialogButton>
                    <Plus />
                    {t("add")}
                  </CustomerDialogButton>
                )
              }
            />
          )
        ) : (
          <>
            {/* Tablet/desktop table */}
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  <TableHead className="text-end">{t("repairs")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className="relative">
                    <TableCell className="font-medium">
                      <Link href={`/customers/${c.id}`} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Ltr>{formatPhone(c.phone, shop.countryCode)}</Ltr>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{c._count.tickets}</TableCell>
                    <TableCell className="text-muted-foreground">{format.dateTime(c.createdAt, { dateStyle: "medium" })}</TableCell>
                    <TableCell>
                      <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Phone list */}
            <ul className="divide-y sm:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <Ltr>{formatPhone(c.phone, shop.countryCode)}</Ltr>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{t("repairsCount", { count: c._count.tickets })}</span>
                    <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t">
              <Pagination page={page} pageSize={pageSize} total={total} basePath="/customers" params={sp} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
