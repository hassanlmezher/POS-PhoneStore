"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function ShopMark({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-9 rounded-lg", className)}>
      {logoUrl && <AvatarImage src={logoUrl} alt="" />}
      <AvatarFallback className="rounded-lg bg-primary text-sm text-primary-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
