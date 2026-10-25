import { useTranslations } from "next-intl";
import { Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Ltr } from "@/components/ltr";
import { LanguageSwitch } from "@/components/app-shell/language-switch";
import { formatPhone } from "@/lib/phone";
import { externalProps } from "@/features/marketing/contact";
import { BrandMark, Container } from "./section-heading";

type Props = {
  appName: string;
  demo: string | null;
  whatsapp: string | null;
  whatsappHref: string | null;
  email: string | null;
};

export function SiteFooter({ appName, demo, whatsapp, whatsappHref, email }: Props) {
  const t = useTranslations("marketing");
  const hasContact = Boolean(whatsapp || email);
  return (
    <footer id="contact" className="scroll-mt-16">
      {demo && (
        <Container className="py-16 sm:py-24">
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{t("cta.title")}</h2>
              <p className="mt-3 leading-relaxed text-primary-foreground/80">{t("cta.body")}</p>
            </div>
            <Button asChild size="lg" variant="secondary" className="w-full shrink-0 bg-card md:w-auto">
              <a href={demo} {...externalProps(demo)}>
                <MessageCircle aria-hidden className="size-5" />
                {t("hero.primary")}
              </a>
            </Button>
          </div>
        </Container>
      )}

      <div className="border-t bg-card">
        <Container className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 font-semibold">
              <BrandMark name={appName} />
              {appName}
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>
          </div>

          {hasContact && (
            <div>
              <h2 className="text-sm font-semibold">{t("footer.contact")}</h2>
              <ul className="mt-3 space-y-1 text-sm">
                {whatsapp && whatsappHref && (
                  <li>
                    <a
                      href={whatsappHref}
                      {...externalProps(whatsappHref)}
                      className="inline-flex min-h-11 items-center gap-2.5 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <MessageCircle aria-hidden className="size-4" />
                      <span className="sr-only">{t("footer.whatsapp")}: </span>
                      <Ltr>{formatPhone(whatsapp, "")}</Ltr>
                    </a>
                  </li>
                )}
                {email && (
                  <li>
                    <a
                      href={`mailto:${email}`}
                      className="inline-flex min-h-11 items-center gap-2.5 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Mail aria-hidden className="size-4" />
                      <span className="sr-only">{t("footer.email")}: </span>
                      <Ltr>{email}</Ltr>
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold">{t("footer.language")}</h2>
            <LanguageSwitch showLabel className="-ms-3 mt-1" />
          </div>
        </Container>
        <div className="border-t">
          <Container className="py-6 text-sm text-muted-foreground">
            {t("footer.rights", { year: new Date().getFullYear(), app: appName })}
          </Container>
        </div>
      </div>
    </footer>
  );
}
