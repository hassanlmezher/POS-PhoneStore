"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addTicketNote } from "@/features/tickets/actions";

export function NoteForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("ticket");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        const res = await addTicketNote(ticketId, body);
        if (!res.ok) return void toast.error(t("saveFailed"));
        setBody("");
        toast.success(t("noteAdded"));
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="ticket-note" className="sr-only">
        {t("addNote")}
      </label>
      <Textarea
        id="ticket-note"
        rows={2}
        placeholder={t("notePlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-subtle-foreground">{t("noteHint")}</span>
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}
          {t("addNote")}
        </Button>
      </div>
    </form>
  );
}
