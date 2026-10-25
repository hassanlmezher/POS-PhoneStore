import { cn } from "@/lib/utils";

/** Centered eyebrow + h2 + optional subtitle used by every landing section. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  className,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function BrandMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground shadow-card",
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}
