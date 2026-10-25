"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions";
import type { Role } from "@/lib/permissions";
import { initials } from "./shop-mark";

type UserMenuProps = { user: { name: string; email: string; role: Role } };

export function UserMenu({ user }: UserMenuProps) {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("common.accountMenu")}
        className="flex h-11 shrink-0 items-center gap-2 rounded-lg ps-1 pe-1 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 lg:pe-2"
      >
        <Avatar className="size-9">
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 flex-col text-start leading-tight xl:flex">
          <span className="max-w-32 truncate text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">{t(`roles.${user.role}`)}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground lg:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-1 py-2">
          <span className="truncate font-semibold">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground" dir="ltr">
            {user.email}
          </span>
          <Badge variant="soft" className="mt-1">
            {t(`roles.${user.role}`)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form
          action={async () => {
            await logout();
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the proxy rewrite runs
            window.location.assign("/login");
          }}
        >
          {/* Keep the menu mounted until the form submits. */}
          <DropdownMenuItem asChild variant="destructive" onSelect={(e) => e.preventDefault()}>
            <button type="submit" className="w-full">
              <LogOut />
              {t("common.signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
