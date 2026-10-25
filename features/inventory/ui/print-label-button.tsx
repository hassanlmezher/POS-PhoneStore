"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "Print label" with a copies count; opens the label sheet in a new tab. */
export function PrintLabelButton({ productId, defaultCopies = 1 }: { productId: string; defaultCopies?: number }) {
  const t = useTranslations("product");
  const [copies, setCopies] = useState(Math.max(1, Math.min(100, defaultCopies)));
  const set = (n: number) => setCopies(Math.max(1, Math.min(100, Number.isFinite(n) ? n : 1)));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Printer />
          {t("printLabel")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <Label htmlFor="label-copies">{t("copies")}</Label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => set(copies - 1)} aria-label={t("fewer")}>
            <Minus />
          </Button>
          <Input
            id="label-copies"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            dir="ltr"
            className="text-center tabular-nums"
            value={copies}
            onChange={(e) => set(Number(e.target.value))}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => set(copies + 1)} aria-label={t("more")}>
            <Plus />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild>
            <a href={`/print/labels?ids=${productId}&copies=${copies}`} target="_blank" rel="noopener">
              {t("labelRoll")}
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/print/labels?ids=${productId}&copies=${copies}&layout=a4`} target="_blank" rel="noopener">
              {t("labelSheet")}
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
