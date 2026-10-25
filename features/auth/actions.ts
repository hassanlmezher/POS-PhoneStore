"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRequestHost } from "@/lib/tenant";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// Redirects happen client-side with a full navigation: a redirect() inside a server
// action renders the target without the proxy's subdomain rewrite.
export type LoginState = { error?: "invalid"; ok?: true } | undefined;

/** Signs in only if the user belongs to the shop (or is super admin on the admin host). */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const h = await headers();
  const host = await getRequestHost();
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { shopId: true, isSuperAdmin: true, active: true, shop: { select: { slug: true } } },
  });

  // Dev `?shop=` mode runs on the root host; the pinned shop slug is passed by the form.
  const slug = host.kind === "shop" ? host.slug : String(formData.get("slug") ?? "");
  const allowed =
    !!user &&
    user.active &&
    (host.kind === "admin" ? user.isSuperAdmin : !!slug && user.shop?.slug === slug);

  // Same error either way, so the form never reveals which shop an email belongs to.
  if (!allowed) return { error: "invalid" };
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: h });
  } catch (e) {
    if (e instanceof APIError) return { error: "invalid" };
    throw e;
  }
  return { ok: true };
}

export async function logout() {
  await auth.api.signOut({ headers: await headers() });
}
