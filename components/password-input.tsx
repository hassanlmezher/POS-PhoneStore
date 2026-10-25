"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generatePassword } from "@/lib/password";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (v: string) => void;
  /** Shows a "Generate" button that fills a readable random password (and reveals it). */
  generate?: boolean;
};

/** Password field with show/hide and an optional generator, for temporary staff/owner passwords. */
export function PasswordInput({ value, onValueChange, generate, className, ...props }: PasswordInputProps) {
  const t = useTranslations("common");
  const [show, setShow] = React.useState(false);
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          {...props}
          type={show ? "text" : "password"}
          dir="ltr"
          autoComplete="new-password"
          spellCheck={false}
          className={cn("pe-11 text-start font-mono", className)}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute end-0 top-0 text-muted-foreground"
          aria-label={show ? t("hidePassword") : t("showPassword")}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {generate && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onValueChange(generatePassword());
            setShow(true);
          }}
        >
          <Wand2 />
          {t("generate")}
        </Button>
      )}
    </div>
  );
}
