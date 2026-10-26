import { NextIntlClientProvider } from "next-intl";
import { clientMessages } from "@/i18n/client-messages";

export default async function ApproveLayout({ children }: { children: React.ReactNode }) {
  return <NextIntlClientProvider messages={await clientMessages("approve")}>{children}</NextIntlClientProvider>;
}
