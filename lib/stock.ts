import "server-only";
import type { MovementReason, Prisma } from "@/lib/generated/prisma/client";

type MoveStockInput = {
  shopId: string;
  productId: string;
  delta: number;
  reason: MovementReason;
  userId: string;
  note?: string;
  saleId?: string;
  ticketItemId?: string;
};

/**
 * The only way stock changes: updates Product.qty and logs a StockMovement.
 * Call inside a transaction. Negative stock is allowed (shown as a warning in the UI).
 */
export async function moveStock(tx: Prisma.TransactionClient, input: MoveStockInput) {
  const product = await tx.product.update({
    where: { id: input.productId, shopId: input.shopId },
    data: { qty: { increment: input.delta } },
    select: { qty: true },
  });
  await tx.stockMovement.create({
    data: {
      shopId: input.shopId,
      productId: input.productId,
      delta: input.delta,
      qtyAfter: product.qty,
      reason: input.reason,
      userId: input.userId,
      note: input.note,
      saleId: input.saleId,
      ticketItemId: input.ticketItemId,
    },
  });
  return product.qty;
}
