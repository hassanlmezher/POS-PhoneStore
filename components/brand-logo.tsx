import Image from "next/image";
import { cn } from "@/lib/utils";

/** The product logo (public/brand/logo.svg). Decorative by default; pass `alt` when it stands alone. */
export function BrandLogo({ className, alt = "", priority }: { className?: string; alt?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.svg"
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={36}
      height={36}
      priority={priority}
      unoptimized
      className={cn("size-9 shrink-0", className)}
    />
  );
}
