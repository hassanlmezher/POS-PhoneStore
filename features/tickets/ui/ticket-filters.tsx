"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListFilter, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { TICKET_STATUSES, type TicketStatusValue } from "@/features/tickets/schema";

/** Status (multi) + technician filters for the table view, synced to the URL. */
export function TicketFilters({ technicians, canFilterTech }: { technicians: { id: string; name: string }[]; canFilterTech: boolean }) {
  const t = useTranslations("tickets");
  const ts = useTranslations("status");
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const statuses = (sp.get("status") ?? "").split(",").filter(Boolean) as TicketStatusValue[];
  const tech = sp.get("tech") ?? "";

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`/tickets?${next.toString()}`, { scroll: false }));
  }

  function toggleStatus(s: TicketStatusValue) {
    const set = new Set(statuses);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    update("status", TICKET_STATUSES.filter((x) => set.has(x)).join(","));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            {pending ? <Loader2 className="animate-spin" /> : <ListFilter />}
            {statuses.length ? t("statusCount", { count: statuses.length }) : t("allStatuses")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {TICKET_STATUSES.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={statuses.includes(s)}
              onCheckedChange={() => toggleStatus(s)}
              onSelect={(e) => e.preventDefault()}
            >
              {ts(s)}
            </DropdownMenuCheckboxItem>
          ))}
          {statuses.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => update("status", "")}>
                <X />
                {t("clearFilter")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canFilterTech && (
        <>
          <label htmlFor="filter-tech" className="sr-only">
            {t("technician")}
          </label>
          <NativeSelect id="filter-tech" wrapperClassName="w-48" value={tech} onChange={(e) => update("tech", e.target.value)}>
            <option value="">{t("allTechnicians")}</option>
            <option value="none">{t("unassigned")}</option>
            {technicians.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
        </>
      )}
    </div>
  );
}
