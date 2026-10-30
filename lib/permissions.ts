export type Role = "OWNER" | "TECHNICIAN" | "CASHIER";

export type Permission =
  | "tickets.create"
  | "tickets.viewAll"
  | "tickets.status"
  | "tickets.items"
  | "pos"
  | "customers.edit"
  | "inventory.adjust"
  | "cash"
  | "reports"
  | "expenses"
  | "prices.edit"
  | "suppliers"
  | "sales.void"
  | "settings";

const matrix: Record<Role, readonly Permission[]> = {
  OWNER: [
    "tickets.create",
    "tickets.viewAll",
    "tickets.status",
    "tickets.items",
    "pos",
    "customers.edit",
    "inventory.adjust",
    "cash",
    "reports",
    "expenses",
    "prices.edit",
    "suppliers",
    "sales.void",
    "settings",
  ],
  CASHIER: ["tickets.create", "tickets.viewAll", "tickets.status", "pos", "customers.edit", "cash"],
  // Technicians see tickets assigned to them + unassigned; enforced in ticket queries.
  TECHNICIAN: ["tickets.create", "tickets.status", "tickets.items"],
};

export function can(role: Role, permission: Permission): boolean {
  return matrix[role].includes(permission);
}
