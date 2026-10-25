"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, type NavItem } from "./nav-items";

type BottomNavProps = { items: NavItem[]; canCreateTicket: boolean };

/** Phone-only bar: 4 most used destinations around a central "New ticket" button. */
export function BottomNav({ items, canCreateTicket }: BottomNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const preferred = ["dashboard", "tickets", "pos", "customers", "inventory"] as const;
  const picks = preferred
    .map((key) => items.find((i) => i.key === key))
    .filter((i): i is NavItem => !!i)
    .slice(0, 4);
  const half = Math.ceil(picks.length / 2);

  const renderItem = ({ key, href, icon: Icon }: NavItem) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
        <span className="max-w-full truncate px-1">{key === "pos" ? t("nav.posShort") : t(`nav.${key}`)}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("common.mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex items-stretch gap-1 px-2 py-1">
        {picks.slice(0, half).map(renderItem)}
        {canCreateTicket && (
          <div className="flex min-w-0 flex-1 basis-0 items-center justify-center">
            <Link
              href="/tickets/new"
              aria-label={t("common.newTicket")}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <Plus className="size-6" aria-hidden />
            </Link>
          </div>
        )}
        {picks.slice(half).map(renderItem)}
      </div>
    </nav>
  );
}
