"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebarState } from "./SidebarStateContext";

// Rendered inside TopBar's own header row - when the sidebar collapses
// down to its thin rail (see Sidebar.tsx), the logo would otherwise
// disappear entirely, so it reappears here instead, in the empty space
// right next to where the sidebar used to be, with the same icon+text
// layout Sidebar.tsx's own header uses while open. Clicking it reopens
// the sidebar, same as clicking the collapsed rail itself.
export default function CollapsedSidebarLogo() {
  const { collapsed, setCollapsed } = useSidebarState();
  const [entered, setEntered] = useState(false);

  // This component doesn't unmount while expanded - it stays mounted the
  // whole time and just renders null (see the early return below) - so
  // `entered` doesn't reset to false on its own between cycles the way a
  // truly unmounted component's state would. Without this, only the very
  // first collapse ever saw entered start at false; every later one
  // re-rendered with entered still true from before and skipped straight
  // to full opacity. Resetting it synchronously during render (React's
  // documented "adjusting state when a prop changes" pattern) rather than
  // in the effect below avoids a one-frame flash at full opacity before
  // the reset would otherwise land.
  const [wasCollapsed, setWasCollapsed] = useState(collapsed);
  if (wasCollapsed !== collapsed) {
    setWasCollapsed(collapsed);
    if (collapsed) setEntered(false);
  }

  useEffect(() => {
    // Two-step mount: start at opacity-0 (already the case, reset above),
    // flip to opacity-100 a frame later, so the transition below has an
    // actual "from" state to animate - a class set at the same moment an
    // element is first inserted into the DOM never transitions, it just
    // appears as-is.
    if (!collapsed || entered) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [collapsed, entered]);

  if (!collapsed) return null;

  return (
    <button
      type="button"
      onClick={() => setCollapsed(false)}
      title="פתיחת הסיידבר"
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-lg px-2 py-1.5 transition-opacity duration-[400ms] ease-in hover:bg-slate-100 dark:hover:bg-night-800",
        entered ? "opacity-100" : "opacity-0"
      )}
    >
      <Image
        src="/web-app-manifest-512x512.png"
        alt="סטודיו דוב אברמסון"
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-lg object-contain"
      />
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">סטודיו דוב אברמסון</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">ניהול פרויקטים</p>
      </div>
    </button>
  );
}
