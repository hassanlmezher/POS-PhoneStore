import * as React from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: React.ReactNode;
  htmlFor: string;
  /** Message key from the `errors` namespace (as returned in action fieldErrors). */
  error?: string | null;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + inline hint/error. Give the control `aria-invalid` and `aria-describedby={`${htmlFor}-msg`}`. */
export function Field({ label, htmlFor, error, hint, optional, className, children }: FieldProps) {
  const t = useTranslations();
  const message = error ? (t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.invalid")) : null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-subtle-foreground">{t("common.optional")}</span>}
      </Label>
      {children}
      {(message || hint) && (
        <p id={`${htmlFor}-msg`} role={message ? "alert" : undefined} className={cn("text-xs", message ? "text-destructive" : "text-muted-foreground")}>
          {message ?? hint}
        </p>
      )}
    </div>
  );
}

/** Props to spread on a control inside <Field>. */
export function fieldAria(id: string, error?: string | null) {
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": `${id}-msg` } as const;
}
