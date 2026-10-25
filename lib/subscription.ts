// Subscriptions are collected manually; the super admin sets status and dates.
// The effective status also accounts for dates passing (trial ended, paid period over).
type SubFields = {
  subscriptionStatus: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED";
  trialEndsAt: Date | null;
  paidUntil: Date | null;
};

export type EffectiveStatus = SubFields["subscriptionStatus"];

export function effectiveStatus(shop: SubFields, now = new Date()): EffectiveStatus {
  if (shop.subscriptionStatus === "TRIAL" && shop.trialEndsAt && shop.trialEndsAt < now) return "EXPIRED";
  if (shop.subscriptionStatus === "ACTIVE" && shop.paidUntil && shop.paidUntil < now) return "EXPIRED";
  return shop.subscriptionStatus;
}

/** Expired or suspended shops can log in and view, but not change anything. */
export function isReadOnly(shop: SubFields, now = new Date()): boolean {
  const s = effectiveStatus(shop, now);
  return s === "EXPIRED" || s === "SUSPENDED";
}
