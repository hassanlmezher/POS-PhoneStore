"use client";

import { useLocale } from "next-intl";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  const locale = useLocale();
  return (
    <Sonner
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !bg-popover !text-popover-foreground !shadow-pop !font-sans",
          description: "!text-muted-foreground",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-destructive",
          warning: "[&_[data-icon]]:!text-warning",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
