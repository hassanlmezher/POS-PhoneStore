import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * node-postgres options from DATABASE_URL. node-pg treats sslmode=require as full verification,
 * so for hosted Postgres with a private CA (Supabase) we verify against DATABASE_CA_CERT instead of
 * turning verification off. No sslmode / sslmode=disable (local Docker Postgres) = plain connection.
 * The `sslmode` param stays in DATABASE_URL for the Prisma CLI (migrate), which handles it itself.
 */
export function pgConfig(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  if (!sslmode || sslmode === "disable") return { connectionString: url.toString() };

  // DATABASE_CA_CERT: a file path (Docker, local) or the PEM text itself (serverless env vars).
  const caSetting = process.env.DATABASE_CA_CERT?.trim();
  const ca = !caSetting
    ? undefined
    : caSetting.startsWith("-----BEGIN")
      ? caSetting.replace(/\\n/g, "\n")
      : readFileSync(path.resolve(/* turbopackIgnore: true */ caSetting), "utf8");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(ca && { ca }) } };
}
