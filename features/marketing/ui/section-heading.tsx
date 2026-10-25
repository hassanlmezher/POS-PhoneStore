import { BrandLogo } from "@/components/brand-logo";
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

/** Product logo next to the product name (the name is printed beside it, so the image is decorative). */
export function BrandMark({ name, className }: { name: string; className?: string }) {
  void name;
  return <BrandLogo className={className} priority />;
}
