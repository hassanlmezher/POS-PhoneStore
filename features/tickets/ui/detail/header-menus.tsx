"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type WaLink = { key: string; text: string; url: string };

/** Main button sends the suggested template; the menu lists the others. Plain links, no popups. */
export function WhatsAppMenu({ links, suggested }: { links: WaLink[]; suggested?: string }) {
  const t = useTranslations("ticket");
  const tt = useTranslations("templates");
  const main = links.find((l) => l.key === suggested) ?? links[0];
  if (!main) return null;
  const others = links.filter((l) => l.key !== main.key);
  return (
    <div className="flex">
      <Button variant="outline" asChild className={others.length ? "rounded-e-none" : undefined}>
        <a href={main.url} target="_blank" rel="noopener" title={main.text}>
          <MessageCircle className="text-success" />
          <span>{t("notify")}</span>
          <span className="hidden text-muted-foreground xl:inline">· {tt(main.key)}</span>
        </a>
      </Button>
      {others.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-s-none border-s-0 px-3" aria-label={t("otherMessages")}>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{t("otherMessages")}</DropdownMenuLabel>
            {[main, ...others].map((l) => (
              <DropdownMenuItem key={l.key} asChild>
                <a href={l.url} target="_blank" rel="noopener" className="flex-col items-start gap-0.5">
                  <span className="font-medium">{tt(l.key)}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{l.text}</span>
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function PrintMenu({ number }: { number: number }) {
  const t = useTranslations("ticket");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Printer />
          {t("print")}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`/print/ticket/${number}?size=80mm`} target="_blank" rel="noopener">
            {t("print80")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/print/ticket/${number}?size=a4`} target="_blank" rel="noopener">
            {t("printA4")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
