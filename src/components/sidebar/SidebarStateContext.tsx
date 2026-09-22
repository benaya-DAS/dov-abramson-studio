"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

type SidebarState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

// Shared between Sidebar.tsx and CollapsedSidebarLogo.tsx (rendered inside
// TopBar) - the two live in separate server-component subtrees (Sidebar
// and TopBar are siblings under AppLayout), so a plain prop can't carry
// "is the sidebar collapsed" from one to the other. This provider wraps
// both at the layout level instead.
const SidebarStateContext = createContext<SidebarState | null>(null);

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1") setCollapsedState(true);
    } catch {
      // Private browsing / storage blocked - just keep the default.
    }
  }, []);

  // useCallback with no deps: a stable identity, not a new function every
  // render - Sidebar.tsx's drag-resize effect depends on this, and
  // collapsing/expanding mid-drag would otherwise tear down and
  // re-subscribe its window listeners on every toggle.
  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Private browsing / storage blocked - the state still applies for
      // this session, just won't persist across reloads.
    }
  }, []);

  return <SidebarStateContext.Provider value={{ collapsed, setCollapsed }}>{children}</SidebarStateContext.Provider>;
}

export function useSidebarState() {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) throw new Error("useSidebarState must be used within a SidebarStateProvider");
  return ctx;
}
