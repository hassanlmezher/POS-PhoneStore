"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** On/off toggle. The thumb moves to the end side, so it mirrors in RTL. */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-card transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        // aria-checked, not data-state: a wrapping trigger (e.g. ConfirmDialog) overrides data-state.
        "bg-input aria-checked:bg-primary",
        // Invisible 44px hit area around the small track.
        "before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-card shadow-card transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5 rtl:data-[state=checked]:-translate-x-5 rtl:data-[state=unchecked]:-translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
