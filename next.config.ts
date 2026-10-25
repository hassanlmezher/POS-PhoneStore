import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev only: shop subdomains (demo.localhost) may load dev resources and live reload.
  allowedDevOrigins: ["*.localhost"],
  // Baseline security headers on every response (HSTS only matters over https, i.e. production).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
  // Logo uploads go through a server action (max 1 MB, checked again on the server).
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Uploaded files and backups are runtime data on a volume; never bundle them (or sources) into the build.
  outputFileTracingExcludes: { "*": ["./data/**/*", "./backups/**/*", "./features/**/*.tsx"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
