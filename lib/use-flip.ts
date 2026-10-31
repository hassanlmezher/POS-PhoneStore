"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Animates children of `list` (marked with `data-flip-id`) from their old place to their new one
 * after any render that moved them (FLIP: transform only). Skipped for users who prefer reduced motion.
 */
export function useFlip(list: RefObject<HTMLElement | null>, ms = 250) {
  const last = useRef(new Map<string, number>());
  // Runs after every render so positions are known as soon as the list appears.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>("[data-flip-id]")];
    const now = new Map(items.map((n) => [n.dataset.flipId!, n.offsetTop]));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      for (const n of items) {
        const before = last.current.get(n.dataset.flipId!);
        const dy = before === undefined ? 0 : before - now.get(n.dataset.flipId!)!;
        if (dy) n.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: ms, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    last.current = now;
  });
}
