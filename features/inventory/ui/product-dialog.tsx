"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createProduct, updateProduct } from "@/features/inventory/actions";
import { PRODUCT_TYPES, type ProductInput, type ProductTypeKey } from "@/features/inventory/schema";
import { formatMoney, parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { marginPercent } from "@/features/inventory/margin";
import { ModelMultiSelect, type ModelOption } from "./model-multi-select";

export type EditableProduct = {
  id: string;
  type: ProductTypeKey;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  costUsdCents: number;
  priceUsdCents: number;
  lowStockThreshold: number;
  active: boolean;
  compatibleModels: ModelOption[];
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  rate: number;
  rounding: number;
  /** Edit mode when set. */
  product?: EditableProduct;
};

const cents = (n: number) => (n ? (n / 100).toFixed(2) : "");

function ProductDialog({ open, onOpenChange, categories, rate, rounding, product }: DialogProps) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const tt = useTranslations("productTypes");
  const router = useRouter();
  const listId = useId();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ProductTypeKey>(product?.type ?? "ACCESSORY");
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [cost, setCost] = useState(cents(product?.costUsdCents ?? 0));
  const [price, setPrice] = useState(cents(product?.priceUsdCents ?? 0));
  const [initialQty, setInitialQty] = useState("");
  const [threshold, setThreshold] = useState(String(product?.lowStockThreshold ?? 2));
  const [active, setActive] = useState(product?.active ?? true);
  const [models, setModels] = useState<ModelOption[]>(product?.compatibleModels ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const costN = cost ? parseMoney(cost, "USD") : 0;
  const priceN = price ? parseMoney(price, "USD") : null;
  const margin = priceN !== null && costN !== null ? marginPercent(priceN, costN) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "required";
    if (!price.trim()) local.price = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    const input: ProductInput = {
      type,
      name,
      sku,
      barcode,
      category,
      cost,
      price,
      lowStockThreshold: threshold || "0",
      active,
      compatibleModelIds: type === "PART" ? models.map((m) => m.id) : [],
      initialQty: initialQty || "0",
    };
    startTransition(async () => {
      try {
        const res = product ? await updateProduct(product.id, input) : await createProduct(input);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          if (!res.fieldErrors) toast.error(t("saveFailed"));
          return;
        }
        toast.success(product ? t("updated") : t("created", { name: name.trim() }));
        onOpenChange(false);
        if (product) router.refresh();
        else if ("id" in res) router.push(`/inventory/${res.id}`);
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc("close")} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("type")} htmlFor="prod-type">
            <Segmented
              id="prod-type"
              label={t("type")}
              value={type}
              onValueChange={setType}
              options={PRODUCT_TYPES.map((v) => ({ value: v, label: tt(v) }))}
              className="w-full sm:w-96"
            />
          </Field>
          <Field label={t("name")} htmlFor="prod-name" error={errors.name}>
            <Input
              {...fieldAria("prod-name", errors.name)}
              autoFocus
              autoComplete="off"
              placeholder={type === "PART" ? t("namePlaceholderPart") : t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("sku")} htmlFor="prod-sku" optional error={errors.sku}>
              <Input
                {...fieldAria("prod-sku", errors.sku)}
                dir="ltr"
                autoComplete="off"
                className="text-start font-mono"
                placeholder="ACC-0001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </Field>
            <Field label={t("barcode")} htmlFor="prod-barcode" optional error={errors.barcode} hint={t("barcodeHint")}>
              <Input
                {...fieldAria("prod-barcode", errors.barcode)}
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                className="text-start font-mono"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                // A scanner ends with Enter; keep the dialog open.
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
            </Field>
          </div>
          <Field label={t("category")} htmlFor="prod-category" optional>
            <Input id="prod-category" list={listId} autoComplete="off" placeholder={t("categoryPlaceholder")} value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id={listId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("cost")} htmlFor="prod-cost" optional error={errors.cost}>
              <MoneyInput {...fieldAria("prod-cost", errors.cost)} value={cost} onValueChange={setCost} rate={rate} rounding={rounding} />
            </Field>
            <Field label={t("price")} htmlFor="prod-price" error={errors.price}>
              <MoneyInput {...fieldAria("prod-price", errors.price)} value={price} onValueChange={setPrice} rate={rate} rounding={rounding} />
            </Field>
          </div>
          {margin !== null && priceN !== null && costN !== null && (
            <p className="-mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
              {t("marginLabel")}{" "}
              <span className={cn("font-semibold tabular-nums", margin < 0 ? "text-destructive" : "text-success")}>
                <bdi dir="ltr">
                  {formatMoney(priceN - costN, "USD")} · {margin}%
                </bdi>
              </span>
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!product && (
              <Field label={t("openingStock")} htmlFor="prod-qty" error={errors.initialQty} hint={t("openingStockHint")}>
                <Input
                  {...fieldAria("prod-qty", errors.initialQty)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  dir="ltr"
                  className="text-start tabular-nums"
                  placeholder="0"
                  value={initialQty}
                  onChange={(e) => setInitialQty(e.target.value)}
                />
              </Field>
            )}
            <Field label={t("lowStockThreshold")} htmlFor="prod-threshold" error={errors.lowStockThreshold} hint={t("lowStockHint")}>
              <Input
                {...fieldAria("prod-threshold", errors.lowStockThreshold)}
                type="number"
                inputMode="numeric"
                min={0}
                dir="ltr"
                className="text-start tabular-nums"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
          </div>
          {type === "PART" && (
            <Field label={t("compatibleModels")} htmlFor="prod-models" optional hint={t("compatibleHint")}>
              <ModelMultiSelect id="prod-models" value={models} onChange={setModels} />
            </Field>
          )}
          {product && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm">
              <input type="checkbox" className="size-4.5 accent-primary" checked={!active} onChange={(e) => setActive(!e.target.checked)} />
              <span>
                <span className="font-medium">{t("archive")}</span>
                <span className="block text-xs text-muted-foreground">{t("archiveHint")}</span>
              </span>
            </label>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? tc("saving") : product ? tc("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Button + product dialog (create, or edit when `product` is set). */
export function ProductDialogButton({
  children,
  variant = "default",
  ...props
}: Omit<DialogProps, "open" | "onOpenChange"> & { children: React.ReactNode; variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {children}
      </Button>
      {open && <ProductDialog open={open} onOpenChange={setOpen} {...props} />}
    </>
  );
}
