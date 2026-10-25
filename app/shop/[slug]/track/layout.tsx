import { NextIntlClientProvider } from "next-intl";
import { clientMessages } from "@/i18n/client-messages";

export default async function TrackLayout({ children }: { children: React.ReactNode }) {
  return <NextIntlClientProvider messages={await clientMessages("track")}>{children}</NextIntlClientProvider>;
}
