"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, UserPlus, UserRound, X } from "lucide-react";
import { Field, fieldAria } from "@/components/field";
import { Ltr } from "@/components/ltr";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findCustomers } from "@/features/customers/actions";
import { formatPhone } from "@/lib/phone";
import { useShopCountryCode } from "@/components/shop-context";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

export type PickedCustomer = { id: string; name: string; phone: string; locale: "EN" | "AR" };
export type NewCustomer = { name: string; phone: string; locale: "EN" | "AR" };

type CustomerPickerProps = {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
  newCustomer: NewCustomer;
  onNewCustomerChange: (c: NewCustomer) => void;
  errors: Record<string, string>;
  autoFocus?: boolean;
};

const looksLikePhone = (s: string) => /^[\d\s+()-]+$/.test(s.trim());

/** Phone/name typeahead over customers, with inline quick-add when nothing matches. */
export function CustomerPicker({ value, onChange, newCustomer, onNewCustomerChange, errors, autoFocus }: CustomerPickerProps) {
  const countryCode = useShopCountryCode();
  const t = useTranslations("intake");
  const tc = useTranslations("common");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [searchedFor, setSearchedFor] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query.trim(), 200);
  const ready = debounced.length >= 2;

  useEffect(() => {
    if (debounced.length < 2) return;
    let stale = false;
    findCustomers(debounced)
      .then((rows) => {
        if (stale) return;
        setResults(rows);
        setSearchedFor(debounced);
        setActive(0);
      })
      .catch(() => {
        if (!stale) setSearchedFor(debounced);
      });
    return () => {
      stale = true;
    };
  }, [debounced]);

  const loading = ready && searchedFor !== debounced;
  const shown = ready && searchedFor === debounced ? results : [];
  const noMatch = ready && searchedFor === debounced && results.length === 0;

  function updateQuery(q: string) {
    setQuery(q);
    setOpen(true);
    // Keep the quick-add fields in sync with what's typed.
    if (looksLikePhone(q)) onNewCustomerChange({ ...newCustomer, phone: q });
    else onNewCustomerChange({ ...newCustomer, name: q, phone: newCustomer.phone });
  }

  function pick(c: PickedCustomer) {
    onChange(c);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && shown.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      // Never submit the form from here: pick the match, or move on to quick-add.
      e.preventDefault();
      if (open && shown[active]) pick(shown[active]);
      else if (noMatch) nameRef.current?.focus();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-primary-soft/50 p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-card">
          <UserRound className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{value.name}</p>
          <p className="text-sm text-muted-foreground">
            <Ltr>{formatPhone(value.phone, countryCode)}</Ltr>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onChange(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <X />
          {t("changeCustomer")}
        </Button>
      </div>
    );
  }

  const quickAddPhoneIsQuery = looksLikePhone(query);

  return (
    <div className="flex flex-col gap-3">
      <Field label={t("customerSearch")} htmlFor="intake-customer" error={errors.customerId}>
        <div className="relative">
          {loading ? (
            <Loader2 aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle-foreground" />
          ) : (
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          )}
          <Input
            {...fieldAria("intake-customer", errors.customerId)}
            ref={inputRef}
            autoFocus={autoFocus}
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="next"
            placeholder={t("customerPlaceholder")}
            className="ps-9"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {open && shown.length > 0 && (
            <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-pop">
              {shown.map((c, i) => (
                <li
                  key={c.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                    i === active && "bg-accent",
                  )}
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <Ltr className="text-muted-foreground">{formatPhone(c.phone, countryCode)}</Ltr>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {noMatch && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/30 p-3 sm:p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="size-4 text-primary" aria-hidden />
            {t("quickAddTitle")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {!quickAddPhoneIsQuery || errors["newCustomer.phone"] ? (
              <Field label={t("phone")} htmlFor="intake-new-phone" error={errors["newCustomer.phone"]}>
                <Input
                  {...fieldAria("intake-new-phone", errors["newCustomer.phone"])}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  className="text-start"
                  autoComplete="off"
                  value={newCustomer.phone}
                  onChange={(e) => onNewCustomerChange({ ...newCustomer, phone: e.target.value })}
                />
              </Field>
            ) : null}
            <Field label={t("customerName")} htmlFor="intake-new-name" error={errors["newCustomer.name"]}>
              <Input
                {...fieldAria("intake-new-name", errors["newCustomer.name"])}
                ref={nameRef}
                autoComplete="off"
                value={newCustomer.name}
                onChange={(e) => onNewCustomerChange({ ...newCustomer, name: e.target.value })}
              />
            </Field>
            <Field label={t("messageLanguage")} htmlFor="intake-new-locale">
              <Segmented
                id="intake-new-locale"
                label={t("messageLanguage")}
                value={newCustomer.locale}
                onValueChange={(locale) => onNewCustomerChange({ ...newCustomer, locale })}
                options={[
                  { value: "EN", label: tc("english") },
                  { value: "AR", label: tc("arabic") },
                ]}
                className="w-full"
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
