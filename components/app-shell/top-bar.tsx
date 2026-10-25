"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Banknote, Menu, Pencil, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RateForm } from "@/features/settings/ui/rate-form";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/permissions";
import { GlobalSearch } from "./global-search";
import { LanguageSwitch } from "./language-switch";
import { UserMenu } from "./user-menu";

type TopBarProps = {
  user: { name: string; email: string; role: Role };
  exchangeRate: number;
  /** Owners can update today's rate from the chip. */
  canEditRate: boolean;
  canSell: boolean;
  readOnly: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onOpenMenu: () => void;
};

const rateFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function RateChip({ rate, editable, className }: { rate: number; editable?: boolean; className?: string }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const content = (
    <>
      <Banknote className="size-4 text-success" aria-hidden />
      <span className="text-muted-foreground">{t("exchangeRate")}</span>
      <span className="font-medium whitespace-nowrap tabular-nums" dir="ltr">
        {rateFormat.format(rate)} {t("perUsd")}
      </span>
    </>
  );
  const base = "flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm shadow-card";
  if (!editable) {
    return (
      <div className={cn(base, className)} title={t("exchangeRate")}>
        {content}
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(base, "transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40", className)}
        aria-label={t("updateRateLabel", { rate: rateFormat.format(rate) })}
      >
        {content}
        <Pencil className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="mb-3 text-sm font-semibold">{t("todayRate")}</p>
        <RateForm rate={rate} compact autoFocus onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export function TopBar({ user, exchangeRate, canEditRate, canSell, readOnly, searchRef, onOpenMenu }: TopBarProps) {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4 lg:gap-3 lg:px-6">
      <Button variant="ghost" size="icon" className="-ms-1 md:hidden" onClick={onOpenMenu} aria-label={t("openMenu")}>
        <Menu className="size-5" />
      </Button>

      <GlobalSearch inputRef={searchRef} />

      <div className="ms-auto flex items-center gap-1.5 lg:gap-2">
        <RateChip rate={exchangeRate} editable={canEditRate} className="hidden xl:flex" />
        <LanguageSwitch className="hidden sm:inline-flex" />

        {canSell &&
          (readOnly ? (
            <Button variant="outline" disabled className="hidden md:inline-flex">
              <ShoppingCart />
              {t("newSale")}
            </Button>
          ) : (
            <Button variant="outline" asChild className="hidden md:inline-flex">
              <Link href="/pos" aria-keyshortcuts="S" aria-label={t("newSale")}>
                <ShoppingCart />
                <span className="hidden xl:inline">{t("newSale")}</span>
                <Kbd className="hidden lg:inline-flex">S</Kbd>
              </Link>
            </Button>
          ))}

        {readOnly ? (
          <Button disabled className="hidden md:inline-flex">
            <Plus />
            {t("newTicket")}
          </Button>
        ) : (
          <Button asChild className="hidden md:inline-flex">
            <Link href="/tickets/new" aria-keyshortcuts="N">
              <Plus />
              {t("newTicket")}
              <Kbd className="hidden lg:inline-flex">N</Kbd>
            </Link>
          </Button>
        )}

        <UserMenu user={user} />
      </div>
    </header>
  );
}
