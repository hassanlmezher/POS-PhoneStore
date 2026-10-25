import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LanguageSwitch } from "@/components/app-shell/language-switch";
import { externalProps } from "@/features/marketing/contact";
import { BrandMark, Container } from "./section-heading";
import { MobileMenu } from "./mobile-menu";

export function SiteHeader({ appName, demo }: { appName: string; demo: string | null }) {
  const t = useTranslations("marketing");
  const links = [
    { href: "#features", label: t("nav.features") },
    { href: "#lebanon", label: t("nav.lebanon") },
    { href: "#pricing", label: t("nav.pricing") },
    { href: "#faq", label: t("nav.faq") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-16 items-center gap-2">
        <a href="#top" className="flex min-h-11 items-center gap-2.5 rounded-lg font-semibold tracking-tight">
          <BrandMark name={appName} />
          <span className="truncate">{appName}</span>
        </a>
        <nav aria-label={t("nav.main")} className="ms-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitch />
          {demo && (
            <Button asChild className="hidden sm:inline-flex">
              <a href={demo} {...externalProps(demo)}>
                {t("hero.primary")}
              </a>
            </Button>
          )}
          <MobileMenu label={t("nav.menu")} links={links} />
        </div>
      </Container>
    </header>
  );
}
