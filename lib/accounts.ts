import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Prisma, Role } from "@/lib/generated/prisma/client";

/**
 * Creates a user with an email/password credential, the same shape Better Auth writes.
 * Used because public sign-up is disabled: owners create staff, the super admin creates owners.
 */
export async function createUserWithPassword(
  tx: Prisma.TransactionClient,
  data: { email: string; name: string; password: string; shopId: string | null; role: Role },
) {
  const id = randomUUID();
  return tx.user.create({
    data: {
      id,
      email: data.email,
      name: data.name,
      emailVerified: true,
      shopId: data.shopId,
      role: data.role,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(data.password) },
      },
    },
    select: { id: true, email: true, name: true, role: true },
  });
}

/** Sets a new password and signs the user out everywhere. */
export async function setUserPassword(tx: Prisma.TransactionClient, userId: string, password: string) {
  await tx.account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: await hashPassword(password) },
  });
  await tx.session.deleteMany({ where: { userId } });
}
