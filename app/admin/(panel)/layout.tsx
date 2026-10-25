import { NextIntlClientProvider } from "next-intl";
import { AdminShell } from "@/features/admin/ui/admin-shell";
import { clientMessages } from "@/i18n/client-messages";
import { getPlatformSettings } from "@/lib/platform";
import { requireSuperAdmin } from "@/lib/tenant";

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const [, platform, messages] = await Promise.all([requireSuperAdmin(), getPlatformSettings(), clientMessages("all")]);
  return (
    <NextIntlClientProvider messages={messages}>
      <AdminShell appName={platform.appName}>{children}</AdminShell>
    </NextIntlClientProvider>
  );
}
