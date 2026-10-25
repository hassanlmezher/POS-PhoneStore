"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, UserPlus, UserRound, X } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findCustomers } from "@/features/customers/actions";
import { CustomerDialog } from "@/features/customers/ui/customer-dialog";
import { formatPhone } from "@/lib/phone";
import { useShopCountryCode } from "@/components/shop-context";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

export type PosCustomer = { id: string; name: string; phone: string };

type Props = {
  value: PosCustomer | null;
  onChange: (c: PosCustomer | null) => void;
  /** Highlights the picker (a balance is left and no customer is set). */
  required?: boolean;
};

const looksLikePhone = (s: string) => /^[\d\s+()-]+$/.test(s.trim());

/** Compact optional customer picker for the cart: typeahead + "new customer" dialog. */
export function PosCustomerPicker({ value, onChange, required }: Props) {
  const countryCode = useShopCountryCode();
  const t = useTranslations("pos");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ q: string; rows: PosCustomer[] }>({ q: "", rows: [] });
  const [dialog, setDialog] = useState(false);
  const debounced = useDebounced(q.trim(), 200);

  useEffect(() => {
    if (debounced.length < 2) return;
    let stale = false;
    findCustomers(debounced)
      .then((rows) => {
        if (stale) return;
        setResult({ q: debounced, rows });
        setActive(0);
      })
      .catch(() => !stale && setResult({ q: debounced, rows: [] }));
    return () => {
      stale = true;
    };
  }, [debounced]);

  const fresh = debounced.length >= 2 && result.q === debounced;
  const rows = fresh ? result.rows : [];
  const loading = debounced.length >= 2 && !fresh;

  function pick(c: PosCustomer) {
    onChange(c);
    setEditing(false);
    setQ("");
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-primary-soft/50 px-3 py-2">
        <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            <Ltr>{formatPhone(value.phone, countryCode)}</Ltr>
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label={t("removeCustomer")}>
          <X />
        </Button>
      </div>
    );
  }

  if (!editing) {
    return (
      <Button
        type="button"
        variant="outline"
        className={cn("w-full justify-start text-muted-foreground", required && "border-warning text-warning")}
        onClick={() => {
          setEditing(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <UserPlus />
        {required ? t("customerRequired") : t("addCustomer")}
      </Button>
    );
  }

  return (
    <div className="relative">
      <label htmlFor="pos-customer" className="sr-only">
        {t("customer")}
      </label>
      {loading ? (
        <Loader2 aria-hidden className="pointer-events-none absolute start-3 top-5.5 size-4 -translate-y-1/2 animate-spin text-subtle-foreground" />
      ) : (
        <Search aria-hidden className="pointer-events-none absolute start-3 top-5.5 size-4 -translate-y-1/2 text-subtle-foreground" />
      )}
      <Input
        ref={inputRef}
        id="pos-customer"
        role="combobox"
        aria-expanded={rows.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="ps-9 pe-11"
        placeholder={t("customerPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && rows.length) {
            e.preventDefault();
            setActive((a) => (a + 1) % rows.length);
          } else if (e.key === "ArrowUp" && rows.length) {
            e.preventDefault();
            setActive((a) => (a - 1 + rows.length) % rows.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (rows[active]) pick(rows[active]);
          } else if (e.key === "Escape") {
            setEditing(false);
            setQ("");
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute end-0 top-0"
        onClick={() => {
          setEditing(false);
          setQ("");
        }}
        aria-label={t("cancelCustomer")}
      >
        <X />
      </Button>
      {debounced.length >= 2 && (fresh || rows.length > 0) && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-xl border bg-popover p-1.5 shadow-pop">
          {rows.length > 0 && (
            <ul id={listId} role="listbox" aria-label={t("customer")}>
              {rows.map((c, i) => (
                <li
                  key={c.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-sm", i === active && "bg-accent")}
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <Ltr className="text-muted-foreground">{formatPhone(c.phone, countryCode)}</Ltr>
                </li>
              ))}
            </ul>
          )}
          {fresh && rows.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">{t("noCustomer")}</p>}
          <Button type="button" variant="ghost" className="w-full justify-start text-primary" onMouseDown={(e) => e.preventDefault()} onClick={() => setDialog(true)}>
            <UserPlus />
            {t("newCustomer")}
          </Button>
        </div>
      )}
      {dialog && (
        <CustomerDialog
          open={dialog}
          onOpenChange={setDialog}
          defaults={looksLikePhone(q) ? { phone: q } : { name: q }}
          onCreated={(c) => pick({ id: c.id, name: c.name, phone: c.phone })}
        />
      )}
    </div>
  );
}
