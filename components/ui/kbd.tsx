import * as React from "react";
import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-md border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground select-none",
        "in-data-[slot=button]:border-white/20 in-data-[slot=button]:bg-white/15 in-data-[slot=button]:text-current",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
