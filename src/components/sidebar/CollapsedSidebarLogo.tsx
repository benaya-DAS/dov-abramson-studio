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

  useEffect(() => {
    // Only runs while mounted, i.e. while collapsed (see the early return
    // below) - `entered` naturally resets to its initial `false` on its
    // own when this unmounts, so there's nothing to reset here for the
    // uncollapsed case. Two-step mount: start at opacity-0, flip to
    // opacity-100 a frame later, so the transition below has an actual
    // "from" state to animate - a class set at the same moment an element
    // is first inserted into the DOM never transitions, it just appears
    // as-is.
    if (!collapsed) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [collapsed]);

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
