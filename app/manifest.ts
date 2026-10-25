import type { MetadataRoute } from "next";
import { getPlatformSettings } from "@/lib/platform";

// Lets shops add the POS to a tablet/phone home screen with the product logo.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { appName } = await getPlatformSettings();
  return {
    name: appName,
    short_name: appName,
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#2347E8",
    icons: [
      { src: "/brand/logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/logo-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
