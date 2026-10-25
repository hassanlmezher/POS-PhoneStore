import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Public path, e.g. "/customers". */
  basePath: string;
  /** Current search params to keep (page is replaced). */
  params?: Record<string, string | string[] | undefined>;
};

function hrefFor(basePath: string, params: PaginationProps["params"], page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === "page" || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) if (item) sp.append(k, item);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** "Showing 1–25 of 120" + previous/next links. Renders nothing when everything fits on one page. */
export function Pagination({ page, pageSize, total, basePath, params }: PaginationProps) {
  const t = useTranslations("common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
      <p className="text-muted-foreground tabular-nums">{t("showingRange", { from, to, total })}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" size="icon" asChild>
            <Link href={hrefFor(basePath, params, page - 1)} aria-label={t("previousPage")}>
              <ChevronLeft className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label={t("previousPage")}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
        )}
        {page < pages ? (
          <Button variant="outline" size="icon" asChild>
            <Link href={hrefFor(basePath, params, page + 1)} aria-label={t("nextPage")}>
              <ChevronRight className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label={t("nextPage")}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        )}
      </div>
    </nav>
  );
}
