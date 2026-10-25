"use client";

import { createContext, useContext } from "react";

/** Per-shop settings client components need (from the database via the shop layout). */
type ShopSettings = { countryCode: string };

const ShopSettingsContext = createContext<ShopSettings | null>(null);

export function ShopSettingsProvider({ value, children }: { value: ShopSettings; children: React.ReactNode }) {
  return <ShopSettingsContext.Provider value={value}>{children}</ShopSettingsContext.Provider>;
}

/** The shop's calling code (Shop.countryCode) for phone display in client components. */
export function useShopCountryCode(): string {
  return useContext(ShopSettingsContext)?.countryCode ?? "";
}
