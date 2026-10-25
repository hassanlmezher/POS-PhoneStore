"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export type RangePreset = { key: string; label: string; from: string; to: string };

type Props = {
  from: string;
  to: string;
  presets: RangePreset[];
  /** Other params to keep (e.g. the active tab). */
  keep?: Record<string, string>;
};

const hrefFor = (from: string, to: string, keep: Record<string, string> = {}) =>
  `/reports?${new URLSearchParams({ ...keep, from, to }).toString()}`;

/**
 * Preset select (Today, Yesterday, Last 7 days, This month, Last month, Custom) that navigates at once,
 * plus from/to day inputs for a custom range. Values are local shop days ("YYYY-MM-DD").
 */
export function DateRangePicker({ from, to, presets, keep }: Props) {
  const t = useTranslations("reports");
  const router = useRouter();
  const current = presets.find((p) => p.from === from && p.to === to)?.key ?? "custom";
  const [mode, setMode] = useState(current);
  const [f, setF] = useState(from);
  const [tt, setT] = useState(to);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (f && tt) router.push(hrefFor(f, tt, keep));
      }}
    >
      <NativeSelect
        aria-label={t("range")}
        value={mode}
        wrapperClassName="w-full sm:w-44"
        onChange={(e) => {
          const p = presets.find((x) => x.key === e.target.value);
          setMode(e.target.value);
          if (p) router.push(hrefFor(p.from, p.to, keep));
        }}
      >
        {presets.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
        <option value="custom">{t("presets.custom")}</option>
      </NativeSelect>
      {mode === "custom" && (
        <>
          <Input
            type="date"
            dir="ltr"
            aria-label={t("from")}
            value={f}
            max={tt || undefined}
            onChange={(e) => setF(e.target.value)}
            className="w-[calc(50%-0.25rem)] sm:w-40"
          />
          <Input
            type="date"
            dir="ltr"
            aria-label={t("to")}
            value={tt}
            min={f || undefined}
            onChange={(e) => setT(e.target.value)}
            className="w-[calc(50%-0.25rem)] sm:w-40"
          />
          <Button type="submit" disabled={!f || !tt || (f === from && tt === to)} className="w-full sm:w-auto">
            {t("apply")}
          </Button>
        </>
      )}
    </form>
  );
}
