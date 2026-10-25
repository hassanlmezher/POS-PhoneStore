"use client";

import { startTransition, useOptimistic, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowRight, ArrowRightLeft, CalendarClock, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { changeTicketStatus } from "@/features/tickets/actions";
import { OPEN_STATUSES, TICKET_STATUSES, type TicketStatusValue } from "@/features/tickets/schema";
import { cn } from "@/lib/utils";
import { initials, isClosed } from "./ticket-utils";

export type BoardCard = {
  id: string;
  number: number;
  label: string;
  status: TicketStatusValue;
  device: string;
  customerName: string;
  promisedAt: Date | null;
  overdue: boolean;
  techName: string | null;
  balanceUsdCents: number;
};

type Column = { key: string; statuses: readonly TicketStatusValue[]; dropTo: TicketStatusValue };

const COLUMNS: Column[] = [
  ...OPEN_STATUSES.map((s) => ({ key: s, statuses: [s] as const, dropTo: s })),
  { key: "CLOSED", statuses: ["PICKED_UP", "CANCELLED", "CANT_FIX"], dropTo: "PICKED_UP" },
];

const dotClasses: Record<string, string> = {
  RECEIVED: "bg-status-received-foreground",
  DIAGNOSING: "bg-status-diagnosing-foreground",
  WAITING_PART: "bg-status-waiting-part-foreground",
  REPAIRING: "bg-status-repairing-foreground",
  READY: "bg-status-ready-foreground",
  CLOSED: "bg-status-picked-up-foreground",
};

type BoardProps = {
  cards: BoardCard[];
  canMove: boolean;
  rate: number;
  rounding: number;
  /** Closed tickets not shown in the Closed column (they're in the table view at closedHref). */
  closedMore: number;
  closedHref: string;
};

// Icons repeated on every card are drawn once and referenced with <use> (a busy board has 70+ cards).
const SPRITE = { move: ArrowRightLeft, due: CalendarClock } as const;

function SpriteDefs() {
  return (
    <svg aria-hidden className="hidden">
      {Object.entries(SPRITE).map(([key, Icon]) => (
        <symbol key={key} id={`tb-${key}`} viewBox="0 0 24 24">
          <Icon />
        </symbol>
      ))}
    </svg>
  );
}

function SpriteIcon({ name, className }: { name: keyof typeof SPRITE; className: string }) {
  return (
    <svg aria-hidden className={className}>
      <use href={`#tb-${name}`} />
    </svg>
  );
}

export function TicketBoard({ cards, canMove, rate, rounding, closedMore, closedHref }: BoardProps) {
  const t = useTranslations("tickets");
  const ts = useTranslations("status");
  const [optimistic, move] = useOptimistic(cards, (state, { id, to }: { id: string; to: TicketStatusValue }) =>
    state.map((c) => (c.id === id ? { ...c, status: to, overdue: c.overdue && !isClosed(to) && to !== "READY" } : c)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function moveCard(card: BoardCard, to: TicketStatusValue) {
    if (card.status === to) return;
    startTransition(async () => {
      move({ id: card.id, to });
      try {
        const res = await changeTicketStatus(card.id, to);
        if (res.ok) toast.success(t("moved", { label: card.label, status: ts(to) }));
        else toast.error(t("moveFailed"));
      } catch {
        toast.error(t("moveFailed"));
      }
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" role="region" aria-label={t("board")} tabIndex={0}>
      <SpriteDefs />
      <div className="flex w-max snap-x snap-mandatory gap-3 sm:gap-4">
        {COLUMNS.map((col) => {
          const items = optimistic.filter((c) => col.statuses.includes(c.status));
          const title = col.key === "CLOSED" ? t("closedColumn") : ts(col.key as TicketStatusValue);
          return (
            <section
              key={col.key}
              aria-label={title}
              onDragOver={(e) => {
                if (!canMove || !dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== col.key) setOver(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const card = optimistic.find((c) => c.id === e.dataTransfer.getData("text/x-ticket-id"));
                if (card && !col.statuses.includes(card.status)) moveCard(card, col.dropTo);
              }}
              className={cn(
                "flex w-[17.5rem] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 transition-colors sm:w-72",
                over === col.key && "border-primary bg-primary-soft/60",
              )}
            >
              <header className="flex h-12 items-center gap-2 px-3">
                <span aria-hidden className={cn("size-2 rounded-full", dotClasses[col.key])} />
                <h2 className="truncate text-sm font-semibold">{title}</h2>
                <span className="ms-auto rounded-md bg-card px-1.5 text-xs font-medium text-muted-foreground tabular-nums shadow-card">
                  {items.length}
                </span>
              </header>
              <ol className="flex min-h-32 flex-col gap-2 px-2 pb-2">
                {items.length === 0 && (
                  <li className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-6 text-xs text-subtle-foreground">
                    <Inbox aria-hidden className="size-4" />
                    {canMove ? t("dropHere") : t("columnEmpty")}
                  </li>
                )}
                {items.map((card) => (
                  <BoardCardView
                    key={card.id}
                    card={card}
                    canMove={canMove}
                    rate={rate}
                    rounding={rounding}
                    dragging={dragId === card.id}
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    onMove={(to) => moveCard(card, to)}
                  />
                ))}
              </ol>
              {col.key === "CLOSED" && closedMore > 0 && (
                <Link
                  href={closedHref}
                  className="mx-2 mb-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-primary hover:bg-card"
                >
                  {t("viewAllClosed", { count: closedMore })}
                  <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                </Link>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCardView({
  card,
  canMove,
  rate,
  rounding,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  card: BoardCard;
  canMove: boolean;
  rate: number;
  rounding: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: TicketStatusValue) => void;
}) {
  const t = useTranslations("tickets");
  const ts = useTranslations("status");
  const format = useFormatter();
  return (
    <li
      draggable={canMove}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-ticket-id", card.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "relative rounded-lg border bg-card p-3 shadow-card transition-[opacity,box-shadow] hover:shadow-pop",
        canMove && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/tickets/${card.number}`}
              draggable={false}
              className="text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/40"
            >
              <Ltr>{card.label}</Ltr>
            </Link>
            {card.status !== "PICKED_UP" && isClosed(card.status) && <StatusBadge status={card.status} className="h-5 px-2" />}
          </div>
          <p dir="auto" className="mt-1 truncate text-sm font-medium rtl:text-right">{card.device}</p>
          <p dir="auto" className="truncate text-xs text-muted-foreground rtl:text-right">{card.customerName}</p>
        </div>
        {canMove && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative z-10 -me-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40"
              aria-label={t("moveTo", { label: card.label })}
            >
              <SpriteIcon name="move" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("moveToLabel")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={card.status} onValueChange={(v) => onMove(v as TicketStatusValue)}>
                {TICKET_STATUSES.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {ts(s)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {card.balanceUsdCents > 0 && (
        <div className="mt-2 flex items-baseline gap-2 text-xs">
          <span className="text-muted-foreground">{t("balance")}</span>
          <Money usdCents={card.balanceUsdCents} rate={rate} rounding={rounding} layout="inline" usdClassName="text-warning" />
        </div>
      )}
      <div className="mt-3 flex min-h-6 items-center gap-2 text-xs">
        {card.promisedAt && (
          <span className={cn("inline-flex items-center gap-1", card.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
            <SpriteIcon name="due" className="size-3.5" />
            {format.dateTime(card.promisedAt, { month: "short", day: "numeric" })}
            {card.overdue && <span>· {t("overdue")}</span>}
          </span>
        )}
        {card.techName && (
          <Avatar className="ms-auto size-6" title={card.techName}>
            <AvatarFallback className="text-[11px]">{initials(card.techName)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </li>
  );
}
