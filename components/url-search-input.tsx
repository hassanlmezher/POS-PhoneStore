"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

type UrlSearchInputProps = {
  /** Public path to navigate to (the browser never sees /shop/<slug>). */
  basePath: string;
  placeholder: string;
  label: string;
  param?: string;
  className?: string;
  autoFocus?: boolean;
};

/** Search box synced to `?q=` (debounced). Resets `?page`. */
export function UrlSearchInput({ basePath, placeholder, label, param = "q", className, autoFocus }: UrlSearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(param) ?? "");
  const debounced = useDebounced(value, 300);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (debounced.trim() === (searchParams.get(param) ?? "")) return;
    const sp = new URLSearchParams(searchParams.toString());
    if (debounced.trim()) sp.set(param, debounced.trim());
    else sp.delete(param);
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div role="search" className={cn("relative", className)}>
      <label className="sr-only" htmlFor={`search-${param}`}>
        {label}
      </label>
      {pending ? (
        <Loader2 aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle-foreground" />
      ) : (
        <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
      )}
      <input
        id={`search-${param}`}
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border bg-card ps-9 pe-3 text-base shadow-card outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 md:text-sm"
      />
    </div>
  );
}
