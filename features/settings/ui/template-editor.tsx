"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCheck, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateTemplate } from "@/features/settings/actions";
import { TEMPLATE_PLACEHOLDERS, type TEMPLATE_KEYS } from "@/features/settings/schema";
import { formatMoney, toLbp } from "@/lib/money";
import { cn } from "@/lib/utils";
import { fillTemplate } from "@/lib/whatsapp";

type Key = (typeof TEMPLATE_KEYS)[number];
type Locale = "EN" | "AR";
type Props = {
  templates: { key: Key; en: string; ar: string }[];
  sample: { shop: string; ticket: string; trackUrl: string; rate: number; rounding: number };
  readOnly: boolean;
};

export function TemplateEditor({ templates, sample, readOnly }: Props) {
  const t = useTranslations("settings.messages");
  const tt = useTranslations("templates");
  const [active, setActive] = useState<Key>(templates[0].key);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(templates.map((x) => [x.key, { EN: x.en, AR: x.ar }])) as Record<Key, Record<Locale, string>>);
  const saved = Object.fromEntries(templates.map((x) => [x.key, { EN: x.en, AR: x.ar }])) as Record<Key, Record<Locale, string>>;
  const dirty = (k: Key) => drafts[k].EN !== saved[k].EN || drafts[k].AR !== saved[k].AR;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label={t("listLabel")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0">
        <ul className="flex min-w-max gap-2 lg:min-w-0 lg:flex-col lg:gap-1">
          {templates.map(({ key }) => (
            <li key={key}>
              <button
                type="button"
                aria-current={active === key ? "true" : undefined}
                onClick={() => setActive(key)}
                className={cn(
                  "flex h-11 w-full items-center gap-2 rounded-lg border px-3 text-start text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 lg:border-transparent",
                  active === key ? "border-primary/30 bg-primary-soft text-primary lg:border-transparent" : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground lg:bg-transparent",
                )}
              >
                <span className="flex-1 truncate">{tt(key)}</span>
                {dirty(key) && <span className="size-2 shrink-0 rounded-full bg-warning" aria-label={t("unsaved")} />}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <TemplateCard
        key={active}
        templateKey={active}
        draft={drafts[active]}
        saved={saved[active]}
        onChange={(locale, body) => setDrafts((d) => ({ ...d, [active]: { ...d[active], [locale]: body } }))}
        sample={sample}
        readOnly={readOnly}
      />
    </div>
  );
}

function TemplateCard({
  templateKey,
  draft,
  saved,
  onChange,
  sample,
  readOnly,
}: {
  templateKey: Key;
  draft: Record<Locale, string>;
  saved: Record<Locale, string>;
  onChange: (locale: Locale, body: string) => void;
  sample: Props["sample"];
  readOnly: boolean;
}) {
  const t = useTranslations("settings.messages");
  const tt = useTranslations("templates");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Partial<Record<Locale, string>>>({});
  const changed = (["EN", "AR"] as const).filter((l) => draft[l] !== saved[l]);

  function save() {
    const errs: Partial<Record<Locale, string>> = {};
    for (const l of changed) if (!draft[l].trim()) errs[l] = "required";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    startTransition(async () => {
      for (const locale of changed) {
        const res = await updateTemplate({ key: templateKey, locale, body: draft[locale] });
        if (!res.ok) {
          setErrors({ [locale]: res.fieldErrors?.body ?? "generic" });
          return;
        }
      }
      toast.success(t("saved", { name: tt(templateKey) }));
      router.refresh();
    });
  }

  return (
    <SectionCard
      title={tt(templateKey)}
      description={t(`purpose.${templateKey}`)}
      actions={
        <>
          {changed.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => changed.forEach((l) => onChange(l, saved[l]))} disabled={pending}>
              <RotateCcw />
              {t("discard")}
            </Button>
          )}
          <Button type="button" size="sm" onClick={save} disabled={pending || readOnly || changed.length === 0}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <LocaleEditor locale="EN" body={draft.EN} error={errors.EN} onChange={(b) => onChange("EN", b)} sample={sample} readOnly={readOnly} />
        <LocaleEditor locale="AR" body={draft.AR} error={errors.AR} onChange={(b) => onChange("AR", b)} sample={sample} readOnly={readOnly} />
      </div>
    </SectionCard>
  );
}

function LocaleEditor({
  locale,
  body,
  error,
  onChange,
  sample,
  readOnly,
}: {
  locale: Locale;
  body: string;
  error?: string;
  onChange: (b: string) => void;
  sample: Props["sample"];
  readOnly: boolean;
}) {
  const t = useTranslations("settings.messages");
  const tc = useTranslations("common");
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = `tpl-${locale}`;
  const ar = locale === "AR";

  function insert(name: string) {
    const el = ref.current;
    const token = `{${name}}`;
    if (!el) return onChange(body + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    onChange(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const balance = 2500;
  const vars = {
    customer: ar ? t("sample.customerAr") : t("sample.customer"),
    device: "iPhone 13 Pro",
    ticket: sample.ticket,
    balance: `${formatMoney(balance, "USD")} (${formatMoney(toLbp(balance, sample.rate, sample.rounding), "LBP")})`,
    shop: sample.shop,
    trackUrl: sample.trackUrl,
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Field label={ar ? tc("arabic") : tc("english")} htmlFor={id} error={error}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("insertLabel")}>
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={readOnly}
              onMouseDown={(e) => e.preventDefault()} // keep the cursor in the textarea
              onClick={() => insert(p)}
              aria-label={t("insert", { name: t(`placeholders.${p}`) })}
              className="inline-flex h-9 items-center gap-1 rounded-full border bg-card ps-2 pe-3 text-xs font-medium text-muted-foreground shadow-card transition-colors outline-none hover:border-primary/40 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden />
              {t(`placeholders.${p}`)}
            </button>
          ))}
        </div>
        <Textarea
          {...fieldAria(id, error)}
          ref={ref}
          lang={ar ? "ar" : "en"}
          dir={ar ? "rtl" : "ltr"}
          rows={5}
          maxLength={1000}
          disabled={readOnly}
          value={body}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>

      <div className="rounded-xl bg-wa-wallpaper p-3 sm:p-4" aria-label={t("previewLabel")} role="figure">
        <p className="mb-2 text-xs font-medium text-wa-meta">{t("previewLabel")}</p>
        <div
          lang={ar ? "ar" : "en"}
          dir={ar ? "rtl" : "ltr"}
          className={cn(
            "relative w-fit max-w-[92%] rounded-lg bg-wa-bubble px-3 pt-2 pb-5 text-sm leading-relaxed whitespace-pre-wrap text-wa-text shadow-card [overflow-wrap:anywhere]",
            "ms-auto rounded-se-none",
          )}
        >
          {body.trim() ? fillTemplate(body, vars) : <span className="text-wa-meta italic">{t("emptyPreview")}</span>}
          <span className="absolute end-2 bottom-1 flex items-center gap-0.5 text-[10px] text-wa-meta" dir="ltr">
            10:42
            <CheckCheck className="size-3.5 text-wa-tick" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

