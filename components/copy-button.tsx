"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Icon button that copies `value` to the clipboard, with a toast. */
export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const t = useTranslations("common");
  const [done, setDone] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast.success(t("copied"));
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  }
  return (
    <Button type="button" variant="outline" size="icon" className={className} onClick={copy} aria-label={label ?? t("copy")}>
      {done ? <Check className="text-success" /> : <Copy />}
    </Button>
  );
}
