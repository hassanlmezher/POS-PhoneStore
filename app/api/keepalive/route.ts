import { prisma } from "@/lib/db";

// Keeps a free Supabase project awake: Supabase pauses free projects after a week without database
// activity, so Vercel Cron (vercel.json) and a GitHub Actions backup call this daily. It writes one
// tiny row (a real write, not just a connection). Safe to leave public: the row is only bumped when
// it's older than 30 minutes, so repeated calls are read-only and cheap.
// GET /api/keepalive → { ok, at }
export const dynamic = "force-dynamic";

const ID = "keepalive";
const MIN_GAP_MS = 30 * 60 * 1000;

export async function GET() {
  try {
    const now = new Date();
    const bumped = await prisma.heartbeat.updateMany({
      where: { id: ID, at: { lt: new Date(now.getTime() - MIN_GAP_MS) } },
      data: { at: now },
    });
    if (bumped.count === 0) await prisma.heartbeat.upsert({ where: { id: ID }, create: { id: ID, at: now }, update: {} });
    const row = await prisma.heartbeat.findUniqueOrThrow({ where: { id: ID } });
    return Response.json({ ok: true, at: row.at }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
