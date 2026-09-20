"use client";

import { useEffect } from "react";

/**
 * Calls `onClose` whenever Escape is pressed anywhere in the document,
 * while `enabled` is true. Shared by every dismissible popover/dropdown/
 * modal in the app instead of each one wiring its own listener - this is
 * what makes Escape close a dropdown regardless of which element inside it
 * currently has focus (a specific input, a plain button, or nothing).
 */
export function useEscapeKey(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, enabled]);
}
