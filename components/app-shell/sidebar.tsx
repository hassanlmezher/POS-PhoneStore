"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isActive, type NavItem } from "./nav-items";
import { ShopMark } from "./shop-mark";

/** Physical side pointing away from the sidebar (Radix tooltips use physical sides). */
function useEndSide(): "left" | "right" {
  return useLocale() === "ar" ? "left" : "right";
}

type SidebarNavProps = {
  items: NavItem[];
  /** Icon-only rail. `"tablet"` = rail only below lg (auto). */
  collapsed: boolean | "tablet";
  onNavigate?: () => void;
};

/** Hides labels when collapsed: always (true), only on tablet widths ("tablet"), or never (false). */
function labelClass(collapsed: SidebarNavProps["collapsed"]) {
  if (collapsed === true) return "sr-only";
  if (collapsed === "tablet") return "md:max-lg:sr-only";
  return "";
}

export function SidebarNav({ items, collapsed, onNavigate }: SidebarNavProps) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const side = useEndSide();
  const pathname = usePathname();
  const hideLabel = labelClass(collapsed);

  return (
    <nav aria-label={tc("mainNav")} className="flex flex-col gap-1 px-3">
      {items.map(({ key, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        const link = (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              collapsed === true && "justify-center px-0",
              collapsed === "tablet" && "md:max-lg:justify-center md:max-lg:px-0",
            )}
          >
            <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-subtle-foreground group-hover:text-foreground")} aria-hidden />
            <span className={cn("truncate", hideLabel)}>{t(key)}</span>
          </Link>
        );
        if (collapsed === false) return <div key={key}>{link}</div>;
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side={side} className={cn(collapsed === "tablet" && "lg:hidden")}>
              {t(key)}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

type DesktopSidebarProps = {
  shop: { name: string; logoUrl: string | null };
  items: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
};

/** Tablet: icon rail. Desktop: full width, user can collapse it to a rail. */
export function DesktopSidebar({ shop, items, collapsed, onToggle }: DesktopSidebarProps) {
  const t = useTranslations("common");
  const side = useEndSide();
  const mode = collapsed ? true : "tablet";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-e bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-[72px] lg:w-64",
      )}
    >
      <div className={cn("flex h-16 items-center gap-3 px-4", collapsed ? "justify-center" : "md:max-lg:justify-center")}>
        <ShopMark name={shop.name} logoUrl={shop.logoUrl} />
        <span className={cn("truncate text-sm font-semibold", collapsed ? "sr-only" : "md:max-lg:sr-only")}>{shop.name}</span>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav items={items} collapsed={mode} />
      </div>
      <div className={cn("hidden border-t p-3 lg:flex", collapsed ? "justify-center" : "justify-end")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label={t(collapsed ? "expandSidebar" : "collapseSidebar")}
              aria-expanded={!collapsed}
              className="text-muted-foreground"
            >
              <ToggleIcon className="size-5 rtl:rotate-180" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>{t(collapsed ? "expandSidebar" : "collapseSidebar")}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
