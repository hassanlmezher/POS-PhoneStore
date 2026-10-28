"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markCheckSent } from "@/features/followups/actions";
import { cn } from "@/lib/utils";

type Props = { ticketId: string; href: string; sent: boolean; className?: string };

/** Opens the 3-day check message (wa.me, new tab) and records that it was sent. */
export function FollowupButton({ ticketId, href, sent, className }: Props) {
  const t = useTranslations("followups");
  const router = useRouter();
  return (
    <Button
      asChild
      size="sm"
      variant={sent ? "outline" : "default"}
      className={cn("h-10", !sent && "bg-success text-success-foreground hover:bg-success/90", className)}
    >
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => void markCheckSent(ticketId).then((r) => r.ok && router.refresh())}>
        <MessageCircle />
        {sent ? t("sendAgain") : t("sendCheck")}
      </a>
    </Button>
  );
}
