"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, CornerDownLeft, KeyRound, Loader2, Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { PatternGrid } from "@/components/pattern-grid";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PriceRow } from "@/features/prices/queries";
import { createTicket } from "@/features/tickets/actions";
import { ACCESSORIES, PAYMENT_METHODS, isValidPattern, type TicketInput } from "@/features/tickets/schema";
import { formatMoney, parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CustomerPicker, type NewCustomer, type PickedCustomer } from "./customer-picker";
import { DevicePicker, type CatalogBrand, type DeviceValue } from "./device-picker";

type IntakeFormProps = {
  catalog: CatalogBrand[];
  technicians: { id: string; name: string }[];
  initialCustomer: PickedCustomer | null;
  defaultAssigneeId: string;
  defaultWarrantyDays: number;
  defaultLocale: "EN" | "AR";
  rate: number;
  rounding: number;
  ticketPrefix: string;
  /** The shop's quick-pick problems (Settings → Quick picks), already in the UI language. */
  problems: { id: string; label: string }[];
  /** Show a link to Settings → Quick picks when there are none (owner). */
  canEditProblems: boolean;
  /** The shop's repair price list (chips for the picked phone). */
  prices: PriceRow[];
  /** From a quick quote: the phone and the quoted prices. */
  initialDevice?: DeviceValue;
  initialQuote?: PriceRow[];
};

const centsText = (c: number) => (c / 100).toFixed(2);

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

// Field error key → element to focus.
const FOCUS: Record<string, string> = {
  customerId: "intake-customer",
  "newCustomer.phone": "intake-new-phone",
  "newCustomer.name": "intake-new-name",
  deviceModelId: "intake-device",
  modelText: "intake-model",
  problem: "intake-problem",
  passcode: "intake-passcode",
  pattern: "intake-pattern",
  estimate: "intake-estimate",
  "deposit.amount": "intake-deposit",
  promisedAt: "intake-promised",
  warrantyDays: "intake-warranty",
};

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-card sm:p-6", className)}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function IntakeForm(props: IntakeFormProps) {
  const t = useTranslations("intake");
  const ta = useTranslations("accessories");
  const tm = useTranslations("paymentMethods");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [customer, setCustomer] = useState<PickedCustomer | null>(props.initialCustomer);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({ name: "", phone: "", locale: props.defaultLocale });
  const [device, setDevice] = useState<DeviceValue>(props.initialDevice ?? null);
  const [imei, setImei] = useState("");
  const [color, setColor] = useState("");
  const [problem, setProblem] = useState(() => (props.initialQuote ?? []).map((p) => p.service).join(locale === "ar" ? "، " : ", "));
  const [pickedPrices, setPickedPrices] = useState<string[]>(() => (props.initialQuote ?? []).map((p) => p.id));
  const [lockKind, setLockKind] = useState<"none" | "passcode" | "pattern">("none");
  const [passcode, setPasscode] = useState("");
  const [pattern, setPattern] = useState("");
  const [accessories, setAccessories] = useState<string[]>([]);
  const [condition, setCondition] = useState("");
  const [estimate, setEstimate] = useState(() => (props.initialQuote?.length ? centsText(props.initialQuote.reduce((sum, p) => sum + p.usdCents, 0)) : ""));
  const [deposit, setDeposit] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<"USD" | "LBP">("USD");
  const [depositMethod, setDepositMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [promised, setPromised] = useState(addDays(1));
  const [assignee, setAssignee] = useState(props.defaultAssigneeId);
  const [warranty, setWarranty] = useState(String(props.defaultWarrantyDays));

  function addProblem(text: string) {
    const sep = locale === "ar" ? "، " : ", ";
    setProblem((p) => {
      const cur = p.trim().replace(/[,،]$/, "");
      if (!cur) return text;
      return cur.includes(text) ? cur : `${cur}${sep}${text}`;
    });
    document.getElementById("intake-problem")?.focus();
  }
  const modelId = device?.kind === "model" ? device.id : null;
  const priceChips = props.prices
    .filter((p) => p.modelId === null || (modelId !== null && p.modelId === modelId))
    .sort((a, b) => Number(a.modelId === null) - Number(b.modelId === null));

  /** Price list chip: adds the repair to the problem and its price to the estimate. */
  function addPrice(p: PriceRow) {
    if (pickedPrices.includes(p.id)) return;
    setPickedPrices((cur) => [...cur, p.id]);
    addProblem(p.service);
    setEstimate((cur) => centsText((parseMoney(cur, "USD") ?? 0) + p.usdCents));
  }


  function toggleAccessory(a: string) {
    setAccessories((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  }

  function fail(errs: Record<string, string>) {
    setErrors(errs);
    const first = Object.keys(FOCUS).find((k) => errs[k]);
    if (first) requestAnimationFrame(() => document.getElementById(FOCUS[first])?.focus());
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (pending) return;
    const local: Record<string, string> = {};
    if (!customer) {
      if (!newCustomer.phone.trim()) local[newCustomer.name ? "newCustomer.phone" : "customerId"] = "required";
      else if (!newCustomer.name.trim()) local["newCustomer.name"] = "required";
    }
    if (!device) local.deviceModelId = "required";
    else if (device.kind === "other" && !device.modelText.trim()) local.modelText = "required";
    if (!problem.trim()) local.problem = "required";
    // Choosing a lock type and leaving it empty would silently save no lock.
    if (lockKind === "passcode" && !passcode.trim()) local.passcode = "required";
    if (lockKind === "pattern" && !isValidPattern(pattern)) local.pattern = "patternTooShort";
    if (Object.keys(local).length) return fail(local);

    const input: TicketInput = {
      ...(customer ? { customerId: customer.id } : { newCustomer }),
      ...(device?.kind === "model" ? { deviceModelId: device.id } : { brandText: device?.brandText, modelText: device?.modelText }),
      imei,
      color,
      problem,
      passcode: lockKind === "passcode" ? passcode : undefined,
      pattern: lockKind === "pattern" ? pattern : undefined,
      accessories: accessories as TicketInput["accessories"],
      conditionNotes: condition,
      estimate,
      deposit: deposit.trim() ? { amount: deposit, currency: depositCurrency, method: depositMethod } : undefined,
      promisedAt: promised ? new Date(`${promised}T18:00`).toISOString() : undefined,
      assignedToId: assignee,
      warrantyDays: warranty === "" ? undefined : Number(warranty),
    };

    startTransition(async () => {
      try {
        const res = await createTicket(input);
        if (!res.ok) {
          const errs = { ...(res.fieldErrors ?? {}) };
          if (errs.deviceModelId && device?.kind === "other") errs.modelText = errs.deviceModelId;
          fail(errs);
          toast.error(t("checkFields"));
          return;
        }
        toast.success(t("created", { label: `${props.ticketPrefix}${res.number}` }));
        router.push(`/tickets/${res.number}?created=1`);
      } catch {
        toast.error(t("createFailed"));
      }
    });
  }

  const quick = [
    { label: t("today"), value: addDays(0) },
    { label: t("tomorrow"), value: addDays(1) },
    { label: t("plus3"), value: addDays(3) },
  ];

  const submitButton = (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Check />}
      {pending ? t("creating") : t("submit")}
      <Kbd className="ms-1 hidden sm:inline-flex">
        <CornerDownLeft className="size-3 rtl:-scale-x-100" aria-hidden />
      </Kbd>
    </Button>
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      onKeyDown={(e) => {
        // Ctrl/Cmd+Enter submits even from a textarea.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
      }}
      className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-6"
    >
      <div className="flex min-w-0 flex-col gap-4 xl:gap-6">
        <Section title={t("customer")}>
          <CustomerPicker
            value={customer}
            onChange={setCustomer}
            newCustomer={newCustomer}
            onNewCustomerChange={setNewCustomer}
            errors={errors}
            autoFocus={!props.initialCustomer}
          />
        </Section>

        <Section title={t("deviceSection")}>
          <DevicePicker autoFocus={!!props.initialCustomer} catalog={props.catalog} value={device} onChange={setDevice} error={errors.deviceModelId ?? errors.modelText} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("imei")} htmlFor="intake-imei" optional error={errors.imei}>
              <Input
                {...fieldAria("intake-imei", errors.imei)}
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                className="text-start tabular-nums"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
              />
            </Field>
            <Field label={t("color")} htmlFor="intake-color" optional>
              <Input id="intake-color" autoComplete="off" value={color} onChange={(e) => setColor(e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title={t("problemSection")}>
          {priceChips.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Tags aria-hidden className="size-3.5" />
                {t("fromPriceList")}
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("fromPriceList")}>
                {priceChips.map((p) => {
                  const on = pickedPrices.includes(p.id);
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={on}
                      className={cn("h-11 rounded-full sm:h-9", on && "border-primary bg-primary/10")}
                      onClick={() => addPrice(p)}
                    >
                      {on ? <Check className="text-primary" /> : <Plus />}
                      <span dir="auto">{p.service}</span>
                      <span dir="ltr" className="text-muted-foreground tabular-nums">
                        {formatMoney(p.usdCents, "USD")}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          {props.problems.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("quickProblems")}>
              {props.problems.map((p) => (
                <Button key={p.id} type="button" variant="outline" size="sm" className="h-11 rounded-full sm:h-9" onClick={() => addProblem(p.label)}>
                  <Plus />
                  {p.label}
                </Button>
              ))}
            </div>
          ) : (
            props.canEditProblems && (
              <p className="text-xs text-muted-foreground">
                {t("noQuickProblems")}{" "}
                <Link href="/settings?tab=quickPicks" className="font-medium text-primary underline-offset-4 hover:underline">
                  {t("addQuickProblems")}
                </Link>
              </p>
            )
          )}
          <Field label={t("problem")} htmlFor="intake-problem" error={errors.problem}>
            <Textarea
              {...fieldAria("intake-problem", errors.problem)}
              rows={3}
              placeholder={t("problemPlaceholder")}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
            />
          </Field>
          <Field label={t("condition")} htmlFor="intake-condition" optional>
            <Input
              id="intake-condition"
              autoComplete="off"
              placeholder={t("conditionPlaceholder")}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            />
          </Field>
        </Section>

        <Section title={t("securitySection")}>
          <Field label={t("screenLock")} htmlFor="intake-lock">
            <Segmented
              id="intake-lock"
              label={t("screenLock")}
              value={lockKind}
              onValueChange={setLockKind}
              options={[
                { value: "none", label: t("lockNone") },
                { value: "passcode", label: t("lockPasscode") },
                { value: "pattern", label: t("lockPattern") },
              ]}
              className="w-full sm:w-96"
            />
          </Field>
          {lockKind === "passcode" && (
            <Field label={t("passcode")} htmlFor="intake-passcode" hint={t("passcodeHint")} error={errors.passcode}>
              <div className="relative sm:max-w-xs">
                <KeyRound aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
                <Input
                  id="intake-passcode"
                  autoFocus
                  dir="ltr"
                  autoComplete="off"
                  className="ps-9 text-start tabular-nums"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                />
              </div>
            </Field>
          )}
          {lockKind === "pattern" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("patternHint")}</p>
              <PatternGrid id="intake-pattern" value={pattern} onChange={setPattern} />
              {errors.pattern && (
                <p role="alert" className="text-sm text-destructive">
                  {te(errors.pattern)}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" id="intake-acc-label">
              {t("accessories")}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="intake-acc-label">
              {ACCESSORIES.map((a) => {
                const on = accessories.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleAccessory(a)}
                    className={cn(
                      "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:h-9",
                      on ? "border-primary bg-primary-soft text-primary" : "bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {on && <Check aria-hidden className="size-4" />}
                    {ta(a)}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
      </div>

      <aside className="grid grid-cols-1 min-w-0 gap-4 md:grid-cols-2 md:items-start xl:sticky xl:top-24 xl:flex xl:flex-col xl:self-start xl:gap-6">
        <Section title={t("moneySection")}>
          <Field label={t("estimate")} htmlFor="intake-estimate" optional error={errors.estimate}>
            <MoneyInput
              {...fieldAria("intake-estimate", errors.estimate)}
              value={estimate}
              onValueChange={setEstimate}
              rate={props.rate}
              rounding={props.rounding}
              placeholder="0.00"
            />
          </Field>
          <Field label={t("deposit")} htmlFor="intake-deposit" optional error={errors["deposit.amount"]}>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <MoneyInput
                  {...fieldAria("intake-deposit", errors["deposit.amount"])}
                  value={deposit}
                  onValueChange={setDeposit}
                  currency={depositCurrency}
                  rate={props.rate}
                  rounding={props.rounding}
                  placeholder="0"
                />
              </div>
              <Segmented
                label={t("currency")}
                value={depositCurrency}
                onValueChange={setDepositCurrency}
                options={[
                  { value: "USD", label: "USD" },
                  { value: "LBP", label: "LBP" },
                ]}
              />
            </div>
          </Field>
          {deposit.trim() && (
            <Field label={t("method")} htmlFor="intake-method">
              <NativeSelect id="intake-method" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value as typeof depositMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {tm(m)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </Section>

        <Section title={t("planSection")}>
          <Field label={t("promised")} htmlFor="intake-promised" error={errors.promisedAt}>
            <div className="grid grid-cols-3 gap-2">
              {quick.map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  variant="outline"
                  aria-pressed={promised === q.value}
                  className={cn("px-2", promised === q.value && "border-primary bg-primary-soft text-primary hover:bg-primary-soft")}
                  onClick={() => setPromised(q.value)}
                >
                  {q.label}
                </Button>
              ))}
            </div>
            <Input
              {...fieldAria("intake-promised", errors.promisedAt)}
              type="date"
              value={promised}
              min={addDays(0)}
              onChange={(e) => setPromised(e.target.value)}
            />
          </Field>
          <Field label={t("technician")} htmlFor="intake-tech">
            <NativeSelect id="intake-tech" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">{t("unassigned")}</option>
              {props.technicians.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("warrantyDays")} htmlFor="intake-warranty" error={errors.warrantyDays}>
            <Input
              {...fieldAria("intake-warranty", errors.warrantyDays)}
              type="number"
              inputMode="numeric"
              min={0}
              max={3650}
              dir="ltr"
              className="text-start tabular-nums"
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
            />
          </Field>
        </Section>

        <div className="hidden xl:block">
          {submitButton}
          <p className="mt-2 text-center text-xs text-muted-foreground">{t("enterHint")}</p>
        </div>
      </aside>

      {/* Phone/tablet: sticky for the whole form, above the bottom nav. */}
      <div className="sticky bottom-20 z-10 rounded-xl border bg-card/95 p-3 shadow-pop backdrop-blur md:bottom-4 xl:hidden">{submitButton}</div>
    </form>
  );
}
