import { ticketAccessWhere } from "@/features/tickets/queries";
import { requireShop } from "@/lib/tenant";

// Staff only: check-in photos and signatures of tickets this user may see. The id never changes,
// so the browser can keep the file; "private" keeps shared caches out.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireShop(slug);
  const media = await ctx.db.ticketMedia.findFirst({
    where: { id, ticket: ticketAccessWhere(ctx.user) },
    select: { data: true, mime: true },
  });
  if (!media) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(media.data), {
    headers: { "Content-Type": media.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
