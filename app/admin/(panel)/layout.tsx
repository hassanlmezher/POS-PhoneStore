import { AdminShell } from "@/features/admin/ui/admin-shell";
import { getPlatformSettings } from "@/lib/platform";
import { requireSuperAdmin } from "@/lib/tenant";

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const [, platform] = await Promise.all([requireSuperAdmin(), getPlatformSettings()]);
  return <AdminShell appName={platform.appName}>{children}</AdminShell>;
}
