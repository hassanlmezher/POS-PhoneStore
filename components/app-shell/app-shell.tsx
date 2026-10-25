"use client";

import { ShopSettingsProvider } from "@/components/shop-context";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { can, type Role } from "@/lib/permissions";
import { BottomNav } from "./bottom-nav";
import { LanguageSwitch } from "./language-switch";
import { navItemsFor } from "./nav-items";
import { ShopMark } from "./shop-mark";
import { DesktopSidebar, SidebarNav } from "./sidebar";
import { RateChip, TopBar } from "./top-bar";
import { useShortcuts } from "./use-shortcuts";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

type AppShellProps = {
  shop: { name: string; logoUrl: string | null; exchangeRate: number; countryCode: string };
  user: { name: string; email: string; role: Role };
  readOnly: boolean;
  children: React.ReactNode;
};

export function AppShell({ shop, user, readOnly, children }: AppShellProps) {
  const t = useTranslations("common");
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const items = navItemsFor(user.role);
  const canSell = can(user.role, "pos");
  const canEditRate = can(user.role, "settings") && !readOnly;
  const canCreateTicket = can(user.role, "tickets.create") && !readOnly;

  useShortcuts({
    slash: () => searchRef.current?.focus(),
    n: canCreateTicket ? () => router.push("/tickets/new") : undefined,
    s: canSell && !readOnly ? () => router.push("/pos") : undefined,
  });

  return (
    <ShopSettingsProvider value={{ countryCode: shop.countryCode }}>
    <TooltipProvider>
      <div className="flex min-h-svh">
        <DesktopSidebar shop={shop} items={items} collapsed={collapsed} onToggle={toggleCollapsed} />

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="start" closeLabel={t("close")} className="gap-0 md:hidden">
            <div className="flex h-16 items-center gap-3 px-4 pe-14">
              <ShopMark name={shop.name} logoUrl={shop.logoUrl} />
              <SheetTitle className="truncate text-sm">{shop.name}</SheetTitle>
              <SheetDescription className="sr-only">{t("mainNav")}</SheetDescription>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <SidebarNav items={items} collapsed={false} onNavigate={() => setMenuOpen(false)} />
            </div>
            <Separator />
            <div className="flex flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <RateChip rate={shop.exchangeRate} editable={canEditRate} className="h-11" />
              <LanguageSwitch showLabel className="w-full" />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          {readOnly && (
            <div role="status" className="flex items-center gap-2 border-b border-warning/20 bg-warning-soft px-4 py-2.5 text-sm text-warning lg:px-6">
              <Lock className="size-4 shrink-0" aria-hidden />
              <span>{t("readOnlyBanner")}</span>
            </div>
          )}
          <TopBar
            user={user}
            exchangeRate={shop.exchangeRate}
            canEditRate={canEditRate}
            canSell={canSell}
            readOnly={readOnly}
            searchRef={searchRef}
            onOpenMenu={() => setMenuOpen(true)}
          />
          <main id="main" className="flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-8 lg:pt-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>

        <BottomNav items={items} canCreateTicket={canCreateTicket} />
      </div>
    </TooltipProvider>
    </ShopSettingsProvider>
  );
}
