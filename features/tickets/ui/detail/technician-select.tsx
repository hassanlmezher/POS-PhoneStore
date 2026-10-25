"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { assignTicket } from "@/features/tickets/actions";

type Props = { ticketId: string; value: string | null; technicians: { id: string; name: string }[]; disabled?: boolean };

export function TechnicianSelect({ ticketId, value, technicians, disabled }: Props) {
  const t = useTranslations("ticket");
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(value ?? "");

  return (
    <>
      <label htmlFor="ticket-tech" className="sr-only">
        {t("technician")}
      </label>
      <NativeSelect
        id="ticket-tech"
        value={current}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            setCurrent(next);
            try {
              const res = await assignTicket(ticketId, next || null);
              if (res.ok) toast.success(next ? t("assigned", { name: technicians.find((u) => u.id === next)?.name ?? "" }) : t("unassignedToast"));
              else toast.error(t("saveFailed"));
            } catch {
              toast.error(t("saveFailed"));
            }
          });
        }}
      >
        <option value="">{t("unassigned")}</option>
        {technicians.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </NativeSelect>
    </>
  );
}
