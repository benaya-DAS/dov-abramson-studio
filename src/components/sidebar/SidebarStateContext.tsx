"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const COLLAPSED_STORAGE_KEY = "sidebar-collapsed";
const WIDTH_STORAGE_KEY = "sidebar-width";

export const MIN_WIDTH = 220;
export const MAX_WIDTH = 480;
export const DEFAULT_WIDTH = 288; // matches the old fixed w-72 (18rem)
// Reopening from fully collapsed always lands at least this wide, rather
// than restoring whatever narrow width it happened to be at right before
// it snapped shut (dragging the handle collapses it once it crosses
// COLLAPSE_THRESHOLD, which is well below this).
export const REOPEN_WIDTH = 300;

export function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

type SidebarState = {
  collapsed: boolean;
  width: number;
  setCollapsed: (collapsed: boolean) => void;
  /** Live width updates (drag mousemove) - state only, no persistence, so
   * a drag doesn't hammer localStorage on every pixel of movement. */
  setWidthLive: (width: number) => void;
  /** A width change that should stick - drag mouseup, or restoring the
   * stored value on mount. */
  commitWidth: (width: number) => void;
};

// Shared between Sidebar.tsx and CollapsedSidebarLogo.tsx (rendered inside
// TopBar) - the two live in separate server-component subtrees (Sidebar
// and TopBar are siblings under AppLayout), so a plain prop can't carry
// "is the sidebar collapsed"/"how wide is it" from one to the other. This
// provider wraps both at the layout level instead.
const SidebarStateContext = createContext<SidebarState | null>(null);

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [width, setWidthState] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1") setCollapsedState(true);
      const storedWidth = localStorage.getItem(WIDTH_STORAGE_KEY);
      const parsedWidth = storedWidth ? Number(storedWidth) : NaN;
      if (Number.isFinite(parsedWidth)) setWidthState(clampWidth(parsedWidth));
    } catch {
      // Private browsing / storage blocked - just keep the defaults.
    }
  }, []);

  const setWidthLive = useCallback((next: number) => {
    setWidthState(next);
  }, []);

  const commitWidth = useCallback((next: number) => {
    setWidthState(next);
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    } catch {
      // Private browsing / storage blocked - the width still applies for
      // this session, just won't persist across reloads.
    }
  }, []);

  // useCallback with no deps: a stable identity, not a new function every
  // render - Sidebar.tsx's drag-resize effect depends on this, and
  // collapsing/expanding mid-drag would otherwise tear down and
  // re-subscribe its window listeners on every toggle.
  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState((prevCollapsed) => {
      // Reopening (collapsed -> expanded): make sure it comes back at a
      // comfortable width instead of whatever narrow value it was at
      // right before collapsing.
      if (prevCollapsed && !next) {
        setWidthState((w) => {
          const wide = Math.max(w, REOPEN_WIDTH);
          try {
            localStorage.setItem(WIDTH_STORAGE_KEY, String(wide));
          } catch {
            // Private browsing / storage blocked - applies for this
            // session only.
          }
          return wide;
        });
      }
      return next;
    });
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Private browsing / storage blocked - the state still applies for
      // this session, just won't persist across reloads.
    }
  }, []);

  return (
    <SidebarStateContext.Provider value={{ collapsed, width, setCollapsed, setWidthLive, commitWidth }}>
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState() {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) throw new Error("useSidebarState must be used within a SidebarStateProvider");
  return ctx;
}
