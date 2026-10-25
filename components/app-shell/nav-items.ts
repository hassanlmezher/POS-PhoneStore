import {
  ChartColumn,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { can, type Permission, type Role } from "@/lib/permissions";

export type NavKey = "dashboard" | "tickets" | "pos" | "sales" | "customers" | "inventory" | "cash" | "reports" | "settings";

export type NavItem = { key: NavKey; href: string; icon: LucideIcon; permission?: Permission };

// Public paths: the browser never sees /shop/<slug>.
const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "tickets", href: "/tickets", icon: Wrench },
  { key: "pos", href: "/pos", icon: ShoppingCart, permission: "pos" },
  { key: "sales", href: "/sales", icon: Receipt, permission: "pos" },
  { key: "customers", href: "/customers", icon: Users },
  { key: "inventory", href: "/inventory", icon: Package },
  { key: "cash", href: "/cash", icon: Wallet, permission: "cash" },
  { key: "reports", href: "/reports", icon: ChartColumn, permission: "reports" },
  { key: "settings", href: "/settings", icon: Settings, permission: "settings" },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
