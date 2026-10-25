import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { ROOT_DOMAIN } from "@/lib/hosts";

const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

// Email + password, sessions in Postgres. Cookies are host-only, so a session on one
// shop's subdomain is never sent to another. Public sign-up is off: staff are created
// by the shop owner or the super admin.
export const auth = betterAuth({
  baseURL: `${protocol}://${ROOT_DOMAIN}`,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [`${protocol}://${ROOT_DOMAIN}`, `${protocol}://*.${ROOT_DOMAIN}`],
  user: {
    additionalFields: {
      shopId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
      isSuperAdmin: { type: "boolean", required: false, input: false },
      active: { type: "boolean", required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Deactivated users can't get a session, even by calling the auth API directly.
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { active: true } });
          if (!user?.active) return false;
        },
      },
    },
  },
  plugins: [nextCookies()],
});
