"use client";

import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Layers, LogOut, Settings2, Store } from "lucide-react";
import { LanguageSwitch } from "@/components/app-shell/language-switch";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

/** Minimal shell for the platform admin: brand, nav links, language and sign out. */
export function AdminShell({ appName, children }: { appName: string; children: React.ReactNode }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  // On the server this is the internal rewritten path (/admin/...); strip it so SSR and client agree.
  const pathname = usePathname().replace(/^\/admin(?=\/|$)/, "") || "/";
  const items = [
    { href: "/", label: t("nav.shops"), icon: Store, active: pathname === "/" || pathname.startsWith("/tenants") },
    { href: "/plans", label: t("nav.plans"), icon: Layers, active: pathname.startsWith("/plans") },
    { href: "/platform", label: t("nav.platform"), icon: Settings2, active: pathname.startsWith("/platform") },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
            <BrandLogo />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold">{appName}</span>
              <span className="text-xs text-muted-foreground">{t("platformAdmin")}</span>
            </span>
          </Link>

          <nav aria-label={tc("mainNav")} className="ms-2 flex items-center gap-1 sm:ms-4">
            {items.map(({ href, label, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
                className={cn(
                  "flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {/* Phones: icons only, so the language and sign-out buttons stay on screen. */}
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitch />
            <form
              action={async () => {
                await logout();
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the proxy rewrite runs
                window.location.assign("/login");
              }}
            >
              <Button type="submit" variant="ghost" className="text-muted-foreground" aria-label={tc("signOut")}>
                <LogOut className="rtl:rotate-180" />
                <span className="hidden sm:inline">{tc("signOut")}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
