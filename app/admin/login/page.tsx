import { LoginForm } from "@/features/auth/login-form";
import { getSession } from "@/lib/tenant";
import { redirectPublic } from "@/lib/public-url";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session?.user.isSuperAdmin) await redirectPublic("/");
  return <LoginForm variant="admin" />;
}
