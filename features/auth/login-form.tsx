"use client";

import { BrandLogo } from "@/components/brand-logo";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initials } from "@/components/app-shell/shop-mark";
import { login } from "@/features/auth/actions";

type LoginFormProps = { variant: "shop" | "admin"; shopName?: string; slug?: string };

export function LoginForm({ variant, shopName, slug }: LoginFormProps) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const invalid = !!state?.error;
  const busy = pending || !!state?.ok;

  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the proxy rewrite runs
    if (state?.ok) window.location.assign("/");
  }, [state]);
  const title = variant === "shop" && shopName ? shopName : t("adminTitle");

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          {variant === "shop" && shopName ? (
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-pop">
              {initials(shopName)}
            </div>
          ) : (
            <BrandLogo className="size-12 shadow-pop rounded-[13px]" priority />
          )}
        </div>
        <Card className="gap-6 py-8">
          <CardHeader className="px-6 text-center sm:px-8">
            <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-8">
            <form action={formAction} className="flex flex-col gap-4" noValidate>
              <input type="hidden" name="slug" value={slug ?? ""} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? "login-error" : undefined}
                  className="text-start rtl:text-end"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? "login-error" : undefined}
                    className="pe-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    aria-pressed={showPassword}
                    className="absolute end-0 top-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>

              {invalid && (
                <p
                  id="login-error"
                  role="alert"
                  className="flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
                >
                  <CircleAlert className="size-4 shrink-0" aria-hidden />
                  {t("invalid")}
                </p>
              )}

              <Button type="submit" size="lg" disabled={busy} className="mt-2 w-full">
                {busy && <LoaderCircle className="animate-spin" aria-hidden />}
                {busy ? t("submitting") : t("submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
