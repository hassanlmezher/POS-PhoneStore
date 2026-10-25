import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";

type LockTable = "Ticket" | "Sale" | "CashSession";

/**
 * Locks rows for the rest of the transaction (SELECT … FOR UPDATE), so a read-check-write sequence
 * (balance, status, totals) can't interleave with the same action from another till or a double-click.
 * Rows are locked in id order to avoid deadlocks.
 */
export async function lockRows(tx: Prisma.TransactionClient, table: LockTable, shopId: string, ids: string[]) {
  if (!ids.length) return;
  await tx.$queryRawUnsafe(
    `SELECT id FROM "${table}" WHERE "shopId" = $1 AND id = ANY($2::text[]) ORDER BY id FOR UPDATE`,
    shopId,
    ids,
  );
}

/** Retries a transaction that lost a unique-key race (two staff creating the same customer or device at once). */
export async function retryOnConflict<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const conflict = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034");
      if (!conflict || attempt >= tries) throw e;
    }
  }
}
