import * as React from "react";
import { cn } from "@/lib/utils";

/** Keeps phone numbers, IMEIs and ticket labels left-to-right inside Arabic text. */
export function Ltr({ className, ...props }: React.ComponentProps<"bdi">) {
  return <bdi dir="ltr" className={cn("tabular-nums", className)} {...props} />;
}
