"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { customerInput, type CustomerInput } from "./schema";
import { searchCustomers } from "./queries";

export type CustomerResult =
  | { ok: true; customer: { id: string; name: string; phone: string; locale: "EN" | "AR" } }
  | { ok: false; error: "invalid" | "duplicatePhone"; fieldErrors?: Record<string, string> };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

export async function createCustomer(input: CustomerInput): Promise<CustomerResult> {
  const { db, shop } = await requireActionShop("tickets.create");
  const parsed = customerInput(shop.countryCode).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    const customer = await db.customer.create({
      data: { ...parsed.data, shopId: "" }, // shopId injected by tenantDb
      select: { id: true, name: true, phone: true, locale: true },
    });
    refreshShop();
    return { ok: true, customer };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "duplicatePhone", fieldErrors: { phone: "duplicatePhone" } };
    }
    throw e;
  }
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<CustomerResult> {
  const { db, shop } = await requireActionShop("customers.edit");
  const parsed = customerInput(shop.countryCode).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    const customer = await db.customer.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true, phone: true, locale: true },
    });
    refreshShop();
    return { ok: true, customer };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "duplicatePhone", fieldErrors: { phone: "duplicatePhone" } };
    }
    throw e;
  }
}

/** Typeahead for the customer picker (phone digits or name). */
export async function findCustomers(q: string) {
  const { db } = await requireActionShop(undefined, { write: false });
  return searchCustomers(db, q);
}
