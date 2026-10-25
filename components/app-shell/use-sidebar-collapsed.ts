"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "sidebar-collapsed";
const EVENT = "sidebar-collapsed-change";

// Fallback when storage is blocked (private mode, previews).
let memory = false;

function read(): boolean {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === null ? memory : v === "1";
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Desktop sidebar collapsed state, remembered per browser. */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    memory = !read();
    try {
      window.localStorage.setItem(KEY, memory ? "1" : "0");
    } catch {
      // Storage blocked: nothing to remember.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [collapsed, toggle] as const;
}
