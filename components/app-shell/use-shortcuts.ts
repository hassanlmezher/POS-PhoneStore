"use client";

import { useEffect, useRef } from "react";

type Handlers = Partial<Record<"slash" | "n" | "s", () => void>>;

const CODES: Record<string, keyof Handlers> = { Slash: "slash", KeyN: "n", KeyS: "s" };

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  // Don't steal keys from open menus/dialogs (typeahead, focus traps).
  return !!target.closest("[role='menu'], [role='dialog'], [role='listbox']");
}

/**
 * Global single-key shortcuts. Uses `event.code` so they work on Arabic keyboard layouts too.
 * Never fires while typing or with modifier keys held.
 */
export function useShortcuts(handlers: Handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      const name = CODES[e.code];
      const handler = name && ref.current[name];
      // Allow Shift only for "/" (it needs Shift on some layouts).
      if (!handler || (e.shiftKey && name !== "slash")) return;
      e.preventDefault();
      handler();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
