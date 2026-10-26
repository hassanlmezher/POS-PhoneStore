import type { PrismaClient } from "@/lib/generated/prisma/client";
import { prisma as defaultClient } from "@/lib/db";

/** Deletes a shop and all its data in one transaction (children first: some relations are RESTRICT). */
export async function deleteShopData(shopId: string, prisma: PrismaClient = defaultClient as unknown as PrismaClient) {
  const where = { shopId };
  await prisma.$transaction([
    prisma.payment.deleteMany({ where }),
    prisma.stockMovement.deleteMany({ where }),
    prisma.saleItem.deleteMany({ where }),
    prisma.sale.deleteMany({ where }),
    prisma.ticketItem.deleteMany({ where }),
    prisma.ticketStatusLog.deleteMany({ where }),
    prisma.ticketNote.deleteMany({ where }),
    prisma.priceApproval.deleteMany({ where }),
    prisma.ticket.deleteMany({ where }),
    prisma.cashMovement.deleteMany({ where }),
    prisma.cashSession.deleteMany({ where }),
    prisma.customer.deleteMany({ where }),
    prisma.product.deleteMany({ where }),
    prisma.deviceModel.deleteMany({ where }),
    prisma.deviceBrand.deleteMany({ where }),
    prisma.shopPreset.deleteMany({ where }),
    prisma.messageTemplate.deleteMany({ where }),
    prisma.exchangeRate.deleteMany({ where }),
    prisma.auditLog.deleteMany({ where }),
    prisma.subscriptionPayment.deleteMany({ where }),
    prisma.shopLogo.deleteMany({ where }),
    prisma.user.deleteMany({ where }),
    prisma.shop.delete({ where: { id: shopId } }),
  ]);
}
