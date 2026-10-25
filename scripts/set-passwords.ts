// Sets one new password on every account that still has a seeded/dev password and signs them out.
// Run before exposing the app publicly:  NEW_PASSWORD='...' pnpm exec tsx scripts/set-passwords.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { PrismaClient } from "../lib/generated/prisma/client";
import { pgConfig } from "../lib/pg-config";

const NEW = process.env.NEW_PASSWORD ?? "";
const OLD = process.env.OLD_PASSWORD ?? "password123";
if (NEW.length < 12) {
  console.error("Set NEW_PASSWORD (12+ characters).");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(pgConfig()) });

async function main() {
  const accounts = await prisma.account.findMany({
    where: { providerId: "credential", password: { not: null } },
    include: { user: { select: { email: true } } },
  });
  const hash = await hashPassword(NEW);
  let changed = 0;
  for (const a of accounts) {
    if (!(await verifyPassword({ hash: a.password!, password: OLD }))) continue;
    await prisma.account.update({ where: { id: a.id }, data: { password: hash } });
    await prisma.session.deleteMany({ where: { userId: a.userId } });
    console.log(`updated ${a.user.email}`);
    changed++;
  }
  console.log(`${changed} account(s) moved off the default password.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
