"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Error boundary for every admin page: plain message + retry, details stay in the console. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="rounded-xl border bg-card shadow-card">
      <EmptyState
        icon={TriangleAlert}
        title={t("pageFailed")}
        body={t("pageFailedBody")}
        action={
          <Button variant="outline" onClick={reset}>
            <RotateCw />
            {t("retry")}
          </Button>
        }
      />
    </div>
  );
}
