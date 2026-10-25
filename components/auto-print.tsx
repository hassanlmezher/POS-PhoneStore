"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the print dialog once the page has rendered (unless `auto` is false, e.g. previews), plus a manual button (hidden when printing). */
export function AutoPrint({ label, auto = true }: { label: string; auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, [auto]);
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer />
      {label}
    </Button>
  );
}
