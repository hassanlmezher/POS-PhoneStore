"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markFollowup } from "@/features/followups/actions";
import type { FollowupKind } from "@/features/followups/rules";
import { cn } from "@/lib/utils";

type Props = { ticketId: string; kind: FollowupKind; href: string; sent: boolean; className?: string };

/** Opens the WhatsApp message (wa.me, new tab) and records that it was sent. */
export function FollowupButton({ ticketId, kind, href, sent, className }: Props) {
  const t = useTranslations("followups");
  const router = useRouter();
  const Icon = kind === "review" ? Star : MessageCircle;
  return (
    <Button
      asChild
      size="sm"
      variant={sent ? "outline" : "default"}
      className={cn("h-10", !sent && "bg-success text-success-foreground hover:bg-success/90", className)}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => void markFollowup(ticketId, kind).then((r) => r.ok && router.refresh())}
      >
        <Icon />
        {sent ? t("sendAgain") : t(kind === "review" ? "sendReview" : "sendCheck")}
      </a>
    </Button>
  );
}
