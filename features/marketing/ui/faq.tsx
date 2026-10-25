import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Container, SectionHeading } from "./section-heading";

const QUESTIONS = [1, 2, 3, 4, 5] as const;

/** Native <details> accordion: keyboard accessible, no client JS. */
export function Faq() {
  const t = useTranslations("marketing.faq");
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-t bg-card py-16 sm:py-24">
      <Container className="max-w-3xl">
        <SectionHeading id="faq-title" eyebrow={t("eyebrow")} title={t("title")} />
        <div className="mt-12 divide-y rounded-xl border bg-background">
          {QUESTIONS.map((n) => (
            <details key={n} className="group" name="faq">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-xl px-5 py-4 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{t(`q${n}`)}</span>
                <ChevronDown
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-muted-foreground">{t(`a${n}`)}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
