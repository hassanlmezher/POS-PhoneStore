import { RESERVED_SLUGS, isValidSlug } from "@/lib/hosts";

/** "Phone Fix Beirut!" → "phone-fix-beirut". Non-Latin names give "" (type the slug by hand). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");
}

/** Error key for a slug, or null when it looks fine (uniqueness is checked on save). */
export function slugHint(slug: string): string | null {
  if (!slug) return "required";
  if (!isValidSlug(slug)) return "invalidSlug";
  if (RESERVED_SLUGS.includes(slug)) return "reservedSlug";
  return null;
}
