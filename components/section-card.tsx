import * as React from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons/links on the end side of the header. */
  actions?: React.ReactNode;
  /** Anchor id (for in-page links). */
  id?: string;
  className?: string;
  /** Padding for the body; tables usually pass `false` and run edge to edge. */
  padded?: boolean;
  children: React.ReactNode;
};

/** White card with a header row (title, description, actions) and a body. */
export function SectionCard({ title, description, actions, id, className, padded = true, children }: SectionCardProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-card", className)}>
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1 basis-40">
          <h2 id={headingId} className="font-semibold">
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn(padded && "p-4 sm:p-6")}>{children}</div>
    </section>
  );
}
