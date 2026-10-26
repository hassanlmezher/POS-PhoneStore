import { Building2, Fuel, Package, Receipt, UsersRound, Wifi, Zap, type LucideIcon } from "lucide-react";
import type { ExpenseCategory } from "@/features/expenses/schema";

export const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  RENT: Building2,
  GENERATOR: Fuel,
  ELECTRICITY: Zap,
  SALARIES: UsersRound,
  INTERNET: Wifi,
  SUPPLIES: Package,
  OTHER: Receipt,
};
