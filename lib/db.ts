import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { pgConfig } from "@/lib/pg-config";

function createClient() {
  const adapter = new PrismaPg(pgConfig());
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

/**
 * Unscoped client. Only for platform code (auth, tenant resolution, super admin).
 * Feature code must use `tenantDb(shopId)`.
 */
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Models that carry a required shopId. DeviceBrand/DeviceModel are excluded (global + shop rows).
const TENANT_MODELS = new Set<string>([
  "Customer",
  "Ticket",
  "TicketItem",
  "TicketStatusLog",
  "TicketNote",
  "Product",
  "StockMovement",
  "Sale",
  "SaleItem",
  "Payment",
  "CashSession",
  "CashMovement",
  "MessageTemplate",
  "ExchangeRate",
  "AuditLog",
]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Prisma client scoped to one shop: injects `shopId` into every top-level `where`
 * and `data` of tenant models. Nested writes must set shopId themselves.
 * Raw queries are NOT scoped; filter on "shopId" by hand.
 */
export function tenantDb(shopId: string) {
  return prisma.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = (args ?? {}) as Record<string, unknown>;
          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where as object), shopId };
          }
          if (operation === "create" || operation === "upsert") {
            const key = operation === "create" ? "data" : "create";
            a[key] = { ...(a[key] as object), shopId };
          }
          if (operation === "createMany" || operation === "createManyAndReturn") {
            const data = a.data as object | object[];
            a.data = Array.isArray(data) ? data.map((d) => ({ ...d, shopId })) : { ...data, shopId };
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
export { Prisma };
