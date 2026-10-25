import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { PlatformSettingsForm } from "@/features/admin/ui/platform-settings-form";
import { prisma } from "@/lib/db";
import { getPlatformSettings } from "@/lib/platform";

export default async function AdminPlatformPage() {
  const [t, platform, shops] = await Promise.all([
    getTranslations("admin.platform"),
    getPlatformSettings(),
    prisma.shop.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <PlatformSettingsForm
        shops={shops}
        settings={{
          appName: platform.appName,
          contactWhatsapp: platform.contactWhatsapp ?? "",
          contactEmail: platform.contactEmail ?? "",
          showcaseShopSlug: platform.showcaseShopSlug ?? "",
        }}
      />
    </div>
  );
}
