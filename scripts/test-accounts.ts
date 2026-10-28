// Temporary accounts for automated tests, so tests never use real passwords.
//   SMOKE_PASSWORD=... pnpm exec tsx --conditions=react-server scripts/test-accounts.ts create
//   pnpm exec tsx --conditions=react-server scripts/test-accounts.ts delete
// Accounts: smoke-{owner,cashier,tech}@test.invalid in the "demo" shop + smoke-admin@test.invalid.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { createUserWithPassword } from "@/lib/accounts";

const ROLES = ["owner", "cashier", "tech"] as const;
const EMAILS = [...ROLES.map((r) => `smoke-${r}@test.invalid`), "smoke-admin@test.invalid"];

async function main() {
  const mode = process.argv[2];
  if (mode === "delete") {
    // Records the test accounts created (tickets, sales, stock moves…) are kept and re-attributed
    // to the shop's real owner, so history stays consistent; then the accounts are removed.
    const testUsers = await prisma.user.findMany({ where: { email: { in: EMAILS } }, select: { id: true, shopId: true } });
    const ids = testUsers.map((u) => u.id);
    if (ids.length) {
      const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: "demo" } });
      const owner = await prisma.user.findFirstOrThrow({
        where: { shopId: shop.id, role: "OWNER", email: { notIn: EMAILS } },
        orderBy: { createdAt: "asc" },
      });
      const to = owner.id;
      await prisma.$transaction([
        prisma.ticket.updateMany({ where: { createdById: { in: ids } }, data: { createdById: to } }),
        prisma.ticket.updateMany({ where: { assignedToId: { in: ids } }, data: { assignedToId: null } }),
        prisma.ticketStatusLog.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.ticketNote.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.priceApproval.updateMany({ where: { createdById: { in: ids } }, data: { createdById: to } }),
        prisma.stockMovement.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.sale.updateMany({ where: { cashierId: { in: ids } }, data: { cashierId: to } }),
        prisma.payment.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.cashSession.updateMany({ where: { openedById: { in: ids } }, data: { openedById: to } }),
        prisma.cashSession.updateMany({ where: { closedById: { in: ids } }, data: { closedById: to } }),
        prisma.cashMovement.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.expense.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.ticketMedia.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.partOrder.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.exchangeRate.updateMany({ where: { setById: { in: ids } }, data: { setById: to } }),
        prisma.auditLog.updateMany({ where: { userId: { in: ids } }, data: { userId: to } }),
        prisma.user.deleteMany({ where: { id: { in: ids } } }),
      ]);
    }
    console.log(`deleted ${ids.length} test account(s)`);
    return;
  }
  const password = process.env.SMOKE_PASSWORD ?? "";
  if (mode !== "create" || password.length < 16) throw new Error("usage: SMOKE_PASSWORD=<16+ chars> … create|delete");
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: "demo" } });
  await prisma.$transaction(async (tx) => {
    for (const r of ROLES) {
      await createUserWithPassword(tx, {
        email: `smoke-${r}@test.invalid`,
        name: `Smoke ${r}`,
        password,
        shopId: shop.id,
        role: r === "owner" ? "OWNER" : r === "cashier" ? "CASHIER" : "TECHNICIAN",
      });
    }
    const admin = await createUserWithPassword(tx, { email: "smoke-admin@test.invalid", name: "Smoke admin", password, shopId: null, role: "OWNER" });
    await tx.user.update({ where: { id: admin.id }, data: { isSuperAdmin: true } });
  });
  console.log("created 4 test accounts");
}
main().then(() => process.exit(0)).catch((e) => (console.error(e.message), process.exit(1)));
