import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { getPlatformSettings } from "@/lib/platform";
import { clientMessages } from "@/i18n/client-messages";
import { dirOf, type AppLocale } from "@/i18n/config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = { themeColor: "#2347E8" };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getPlatformSettings()).appName };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getLocale()) as AppLocale;
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${inter.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider messages={await clientMessages("base")}>
          {children}
          <Toaster position={locale === "ar" ? "bottom-left" : "bottom-right"} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
