// Sets the password (and optionally a new e-mail) on specific accounts, then signs them out everywhere.
//   EMAILS='a@x.com,b@x.com' NEW_PASSWORD='...' pnpm exec tsx scripts/set-login.ts
//   EMAILS='old@x.com' NEW_EMAIL='new@x.com' NEW_PASSWORD='...' pnpm exec tsx scripts/set-login.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../lib/generated/prisma/client";
import { pgConfig } from "../lib/pg-config";

const EMAILS = (process.env.EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const NEW_EMAIL = process.env.NEW_EMAIL?.trim().toLowerCase();
const NEW = process.env.NEW_PASSWORD ?? "";
if (!EMAILS.length || NEW.length < 8 || (NEW_EMAIL && EMAILS.length !== 1)) {
  console.error("Set EMAILS, NEW_PASSWORD (8+ characters) and, for one account only, NEW_EMAIL.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(pgConfig()) });

async function main() {
  const hash = await hashPassword(NEW);
  for (const email of EMAILS) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      console.error(`not found: ${email}`);
      process.exitCode = 1;
      continue;
    }
    await prisma.$transaction([
      prisma.account.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { password: hash } }),
      ...(NEW_EMAIL ? [prisma.user.update({ where: { id: user.id }, data: { email: NEW_EMAIL } })] : []),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    console.log(`updated ${email}${NEW_EMAIL ? ` → ${NEW_EMAIL}` : ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
