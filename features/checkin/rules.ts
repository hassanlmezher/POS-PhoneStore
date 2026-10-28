import { z } from "zod";

/** What staff check with the customer at drop-off. */
export const CHECKLIST_ITEMS = ["SCREEN", "TOUCH", "CAMERAS", "BUTTONS", "FACE_ID", "CHARGING", "SOUND", "SIGNAL"] as const;
export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];
/** ok = works, issue = problem found, na = could not test (e.g. phone does not turn on). */
export const CHECK_VALUES = ["ok", "issue", "na"] as const;
export type CheckValue = (typeof CHECK_VALUES)[number];
export type Checklist = Partial<Record<ChecklistItem, CheckValue>>;

export const checklistInput = z.record(z.enum(CHECKLIST_ITEMS), z.enum(CHECK_VALUES)).transform((v) => v as Checklist);

/** Photos per ticket, and the largest upload accepted (photos are shrunk on the device first). */
export const MAX_PHOTOS = 8;
export const MAX_MEDIA_BYTES = 1_500_000;

/** Stored JSON → typed checklist (unknown keys/values dropped). */
export function readChecklist(json: unknown): Checklist {
  const parsed = checklistInput.safeParse(json ?? {});
  return parsed.success ? parsed.data : {};
}
